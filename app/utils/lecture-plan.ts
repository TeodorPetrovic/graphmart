export interface LectureLink {
  label: string
  to: string
}

export interface LectureStep {
  id: string
  title: string
  minutes: number
  say: string
  show: string
  links: LectureLink[]
}

export interface LecturePlan {
  number: 1 | 2
  title: string
  focus: string
  steps: LectureStep[]
}

const open = (to: string, label = 'Open'): LectureLink => ({ label, to })
const compare = (id: string, label = 'Compare'): LectureLink => ({ label, to: `/lab/${id}` })

/**
 * The in-app agenda. The full script is in docs/LECTURE-1.md and docs/LECTURE-2.md.
 * Steps that write data come after the comparisons, so MySQL still matches while comparing.
 */
export const LECTURE_PLAN: LecturePlan[] = [
  {
    number: 1,
    title: 'Class 1 · Products, orders, and MongoDB',
    focus: 'Product attributes, order history, and the measured database timings.',
    steps: [
      {
        id: 'meet',
        title: 'Meet the shop and its data model',
        minutes: 5,
        say: 'This is one application. It used to be eighteen tables.',
        show: 'For you, then Data model.',
        links: [open('/', 'For you'), open('/model', 'Data model')],
      },
      {
        id: 'browse',
        title: 'Filters that adapt to the products',
        minutes: 8,
        say: 'A laptop and a coffee maker have different details. Nobody changed a table to allow that.',
        show: 'Choose Laptops, use the attribute checkboxes and category select, then change category.',
        links: [open('/shop?categoryId=3', 'Laptops'), open('/shop', 'All products')],
      },
      {
        id: 'product',
        title: 'One product, one page',
        minutes: 7,
        say: 'Everything the page needs is stored the way the page reads it.',
        show: 'Specifications, reviews, and the "How this works" panel.',
        links: [open('/shop/1')],
      },
      {
        id: 'compare',
        title: 'Compare the product page and indexes',
        minutes: 8,
        say: 'The product page takes about 2 ms in MySQL and 3 ms in MongoDB. Indexes affect both.',
        show: 'Comparisons: product page, then index impact with useIndex set to 1 and 0.',
        links: [compare('product-page', 'Product page'), compare('index-impact', 'Indexes')],
      },
      {
        id: 'checkout',
        title: 'Buy something, live',
        minutes: 10,
        say: 'The order updates stock and saves an event that is copied to Neo4j.',
        show: 'Shop as user 7, add a product, check the order, place it, then view Orders and Sync.',
        links: [open('/shop', 'Products'), open('/cart', 'Cart'), open('/orders', 'Orders'), open('/sync', 'Sync')],
      },
      {
        id: 'insights',
        title: 'Sales',
        minutes: 4,
        say: 'Reports come straight from the orders. Large reports are where MySQL is stronger.',
        show: 'Sales, then the monthly revenue scenario in Comparisons.',
        links: [open('/analytics', 'Sales'), compare('monthly-revenue', 'Comparisons')],
      },
      {
        id: 'close-1',
        title: 'Questions about connected people',
        minutes: 3,
        say: 'The next class looks at questions about connections between people.',
        show: 'Open the Lecture plan for class 2.',
        links: [open('/present', 'Lecture plan')],
      },
    ],
  },
  {
    number: 2,
    title: 'Class 2 · People, recommendations, and fraud review',
    focus: 'Recommendations with reasons, fraud warnings and routes.',
    steps: [
      {
        id: 'for-you',
        title: 'Recommendations that explain themselves',
        minutes: 4,
        say: 'Recommendations show the people whose purchases led to each product.',
        show: 'For you, then change the shopper and watch the page change.',
        links: [open('/')],
      },
      {
        id: 'social-proof',
        title: 'Who do I know that bought this?',
        minutes: 6,
        say: 'The page shows buyers and the people connecting them to the shopper.',
        show: 'Product page: buyers in your network, then products bought by the same customers.',
        links: [open('/shop/1')],
      },
      {
        id: 'people',
        title: 'People',
        minutes: 10,
        say: 'Each extra step multiplies the people you can reach.',
        show: 'Suggestions, Network, Connect two people, and Referrals.',
        links: [open('/social', 'People')],
      },
      {
        id: 'proof',
        title: 'Why this was impractical before',
        minutes: 9,
        say: 'MySQL is faster for some shallow queries. The graph uses fewer steps for longer paths.',
        show: 'Network depth 1 to 5, shortest path, then the old nested queries.',
        links: [
          compare('friends-network', 'Network'),
          compare('shortest-path', 'Shortest path'),
          compare('people-you-may-know', 'Where SQL wins'),
          open('/model', 'Data model'),
        ],
      },
      {
        id: 'fraud',
        title: 'Catch a fraud ring, live',
        minutes: 9,
        say: 'A fraudster can change a name. Sharing a card or a device still connects the accounts.',
        show: 'As user 9, check out with the suspicious card, place the order, then open the case.',
        links: [open('/shop/3', 'Product 3'), open('/cart', 'Cart'), open('/fraud', 'Fraud review')],
      },
      {
        id: 'delivery',
        title: 'Plan a delivery',
        minutes: 4,
        say: 'The route with the fewest stops can differ from the fastest route.',
        show: 'Switch between fastest, shortest and fewest stops.',
        links: [open('/logistics')],
      },
      {
        id: 'close-2',
        title: 'Use each database where it fits',
        minutes: 3,
        say: 'MongoDB owns what things are. Neo4j owns how they connect. Choose per question.',
        show: 'Sync: compare counts in MongoDB and Neo4j.',
        links: [open('/sync', 'Sync')],
      },
    ],
  },
]
