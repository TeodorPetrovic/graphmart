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
    title: 'Class 1 · A shop that can sell anything, safely',
    focus: 'Flexible products, fast screens and orders that never half happen.',
    steps: [
      {
        id: 'meet',
        title: 'Meet the shop, and what it replaced',
        minutes: 5,
        say: 'This is one application. It used to be eighteen tables.',
        show: 'The home page, then the old tables.',
        links: [open('/'), open('/model', 'Old tables')],
      },
      {
        id: 'browse',
        title: 'Filters that adapt to the products',
        minutes: 8,
        say: 'A laptop and a coffee maker have different details. Nobody changed a table to allow that.',
        show: 'Choose Laptops, tick memory and colour, then switch category and watch the filters change.',
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
        title: 'Old against new, honestly',
        minutes: 8,
        say: 'Reading is not faster than MySQL here. The right index matters far more than the database.',
        show: 'Product page comparison, then run the index comparison with 1 and 0.',
        links: [compare('product-page', 'Product page'), compare('index-impact', 'Indexes')],
      },
      {
        id: 'checkout',
        title: 'Buy something, live',
        minutes: 10,
        say: 'Stock, order and notification change together. The rest of the shop hears about it within moments.',
        show: 'Shop as user 7, buy a product, watch the timeline, then My orders and Live sync.',
        links: [open('/shop', 'Pick a product'), open('/cart', 'Checkout'), open('/sync', 'Live sync')],
      },
      {
        id: 'insights',
        title: 'The store team’s view',
        minutes: 4,
        say: 'Reports come straight from the orders. Large reports are where MySQL is stronger.',
        show: 'Store insights, then the monthly revenue comparison.',
        links: [open('/analytics'), compare('monthly-revenue')],
      },
      {
        id: 'close-1',
        title: 'Wrap up',
        minutes: 3,
        say: 'We gained flexibility and safe writes. Next time: questions about connections.',
        show: 'Return to the home page.',
        links: [open('/')],
      },
    ],
  },
  {
    number: 2,
    title: 'Class 2 · A shop that knows how people are connected',
    focus: 'Recommendations with reasons, fraud warnings and routes.',
    steps: [
      {
        id: 'for-you',
        title: 'Recommendations that explain themselves',
        minutes: 4,
        say: 'Every suggestion can name the people behind it.',
        show: 'For you, then change the shopper and watch the page change.',
        links: [open('/')],
      },
      {
        id: 'social-proof',
        title: 'Who do I know that bought this?',
        minutes: 6,
        say: 'The answer is not just a number. It is a chain of real people.',
        show: 'Product page: people you know, then often bought together.',
        links: [open('/shop/1')],
      },
      {
        id: 'people',
        title: 'People and connections',
        minutes: 10,
        say: 'Each extra step multiplies the people you can reach.',
        show: 'Discover, your circle at 1, 2 and 3 steps, user 1 to user 50, referrals.',
        links: [open('/social')],
      },
      {
        id: 'proof',
        title: 'Why this was impractical before',
        minutes: 9,
        say: 'One or two steps are fine in MySQL. Further than that the graph pulls far ahead.',
        show: 'Network depth 1 to 5, shortest path, then the old nested queries.',
        links: [
          compare('friends-network', 'Network'),
          compare('shortest-path', 'Shortest path'),
          compare('people-you-may-know', 'Where SQL wins'),
          open('/model', 'Old queries'),
        ],
      },
      {
        id: 'fraud',
        title: 'Catch a fraud ring, live',
        minutes: 9,
        say: 'A fraudster can change a name. Sharing a card or a device still connects the accounts.',
        show: 'As user 9, check out with the suspicious card, place the order, then open the case.',
        links: [open('/shop/3', 'Pick a product'), open('/cart', 'Checkout'), open('/fraud', 'Trust & safety')],
      },
      {
        id: 'delivery',
        title: 'Plan a delivery',
        minutes: 4,
        say: 'The fastest route and the one with the fewest stops are not always the same.',
        show: 'Switch between fastest, shortest and fewest stops.',
        links: [open('/logistics')],
      },
      {
        id: 'close-2',
        title: 'Better together',
        minutes: 3,
        say: 'MongoDB owns what things are. Neo4j owns how they connect. Choose per question.',
        show: 'Live sync: reconcile the two databases.',
        links: [open('/sync')],
      },
    ],
  },
]
