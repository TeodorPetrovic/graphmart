import type { AnalyticsResponse } from '../../../shared/types/api'
import { collections } from '../../infrastructure/mongo/client'
import { shell, type Tracer } from '../../infrastructure/trace'

// One facet reads the order stream once for monthly, category, and customer views.
const dashboardPipeline = [
  { $match: { status: { $ne: 'cancelled' } } },
  {
    $facet: {
      revenueByMonth: [
        { $set: { month: { $dateTrunc: { date: '$createdAt', unit: 'month' } } } },
        { $group: { _id: '$month', revenueCents: { $sum: '$totalCents' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        {
          // Window accumulation turns monthly totals into a running revenue line.
          $setWindowFields: {
            sortBy: { _id: 1 },
            output: { runningTotalCents: { $sum: '$revenueCents', window: { documents: ['unbounded', 'current'] } } },
          },
        },
        {
          $project: {
            _id: 0,
            month: { $dateToString: { format: '%Y-%m', date: '$_id' } },
            revenueCents: 1,
            orders: 1,
            runningTotalCents: 1,
          },
        },
      ],
      categoryRevenue: [
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.categoryId',
            revenueCents: { $sum: { $multiply: ['$items.unitPriceCents', '$items.quantity'] } },
            units: { $sum: '$items.quantity' },
          },
        },
        { $sort: { revenueCents: -1 } },
        { $limit: 8 },
        // The order item keeps its category id, while Mongo supplies the current label.
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { _id: 0, categoryId: '$_id', name: '$category.name', revenueCents: 1, units: 1 } },
      ],
      topCustomers: [
        { $group: { _id: '$userId', spentCents: { $sum: '$totalCents' }, orders: { $sum: 1 } } },
        { $sort: { spentCents: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { _id: 0, userId: '$_id', name: '$user.name', spentCents: 1, orders: 1 } },
      ],
    },
  },
]

const ratingPipeline = [
  { $group: { _id: '$rating', count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
  { $project: { _id: 0, rating: '$_id', count: 1 } },
]

const viewsPipeline = [
  { $group: { _id: '$meta.productId', views: { $sum: 1 } } },
  { $sort: { views: -1 } },
  { $limit: 10 },
  { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
  { $unwind: '$product' },
  { $project: { _id: 0, productId: '$_id', name: '$product.name', views: 1 } },
]

interface DashboardRows {
  revenueByMonth: AnalyticsResponse['revenueByMonth']
  categoryRevenue: AnalyticsResponse['topCategories']
  topCustomers: AnalyticsResponse['topCustomers']
}

export async function analyticsDashboard(tracer: Tracer): Promise<Omit<AnalyticsResponse, 'trace'>> {
  const [dashboard, ratingDistribution, mostViewed] = await Promise.all([
    tracer.run('mongo', 'Aggregate order dashboard', shell('orders', 'aggregate', dashboardPipeline), () =>
      collections().orders.aggregate<DashboardRows>(dashboardPipeline).next(),
    ),
    tracer.run('mongo', 'Count review ratings', shell('reviews', 'aggregate', ratingPipeline), () =>
      collections().reviews.aggregate<AnalyticsResponse['ratingDistribution'][number]>(ratingPipeline).toArray(),
    ),
    tracer.run('mongo', 'Rank product views', shell('product_views', 'aggregate', viewsPipeline), () =>
      collections().productViews.aggregate<AnalyticsResponse['mostViewed'][number]>(viewsPipeline).toArray(),
    ),
  ])
  return {
    revenueByMonth: dashboard?.revenueByMonth ?? [],
    topCategories: dashboard?.categoryRevenue ?? [],
    topCustomers: dashboard?.topCustomers ?? [],
    ratingDistribution,
    mostViewed,
  }
}
