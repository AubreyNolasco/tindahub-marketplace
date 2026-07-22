const shared = [
  { id: 'register', keywords: ['register','registration','sign up','signup','create account','join'], title: 'Create a JOM HUB account', route: '/signup', actionLabel: 'Register now', answer: 'Select Register now, verify your Gmail with the 6-digit OTP, choose Reseller or Merchant, and complete the required account details.' },
  { id: 'schedule', keywords: ['schedule','appointment','calendar','training','orientation','book date'], title: 'Schedule registration or training', route: '/#registration-calendar', actionLabel: 'Choose a schedule', answer: 'Select Choose a schedule to open the registration calendar. Pick an available date and time, enter your contact details, and submit the request for Admin confirmation.' },
  { id: 'information', keywords: ['information','details','learn more','what is jom hub','about jom hub','benefits'], title: 'JOM HUB information', route: '/#benefits', actionLabel: 'View system information', answer: 'JOM HUB connects approved Merchants and Resellers through organized products, customers, orders, wallet payments, delivery tracking, reports, notifications, and protected case handling.' },
  { id: 'security', keywords: ['otp','password','security','safe','scam','reference'], title: 'Account security', answer: 'Keep your email OTP, password, bank OTP, and payment codes private. Use a unique payment reference for every request and keep all order and payment evidence inside JOM HUB.' },
  { id: 'address', keywords: ['address','delivery address','pickup address'], title: 'Account address', answer: 'Open Update Account or the Address page and save a complete address. JOM HUB requires complete location details before protected ordering and fulfillment actions are available.' },
  { id: 'case', keywords: ['cancel','cancellation','dispute','return','replacement','refund','problem'], title: 'Order cases', answer: 'Open the affected order, select Request Cancellation / Help, choose the correct case type, explain the issue, and attach evidence when required. An open case pauses automatic completion while it is reviewed.' },
  { id: 'notification', keywords: ['notification','alert','bell'], title: 'Notifications', answer: 'Use the bell in the workspace header to review account-specific order, wallet, subscription, and case updates.' },
  { id: 'guide', keywords: ['guide','walkthrough','tutorial','how to use'], title: 'Page guide', answer: 'Select the guide icon beside the notification bell. It highlights the controls on your current page and explains each action step by step.' },
  { id: 'next-action', keywords: ['next action','what next','what should i do','priority','setup checklist','progress'], title: 'Setup checklist and Next Action', answer: 'Open your dashboard to see the five-step setup checklist and Recommended Next Action card. Each incomplete step links directly to the page where you can finish it.' },
  { id: 'receipt', keywords: ['receipt','print receipt','transaction record','proof of transaction'], title: 'Printable receipts', answer: 'Open the related order or Wallet request and select Print receipt. JOM HUB provides printable records for orders, top-ups, and withdrawals; always compare them with the official external payment record.' }
  ,{ id: 'mobile-navigation', keywords: ['mobile menu','bottom navigation','phone navigation','mobile navigation'], title: 'Mobile workspace navigation', answer: 'On your phone, use the bottom bar for Home, Products, Orders, Wallet, and Account. The full side menu remains available for customers, reports, campaigns, messages, and other tools.' }
  ,{ id: 'order-timeline', keywords: ['order timeline','order progress','order status steps'], title: 'Visual order timeline', answer: 'Each order shows Confirmed, Processing, Shipped, and Completed. The label under each step identifies whether the Merchant, Reseller, or system is responsible for the next action.' }
]

const roleKnowledge = {
  reseller: [
    { id: 'start', keywords: ['start','begin','activate','approval','onboarding'], title: 'Reseller activation', route: '/reseller/account', answer: 'Complete your profile and address, submit the required initial top-up proof, and wait for Admin approval. After activation, add a customer before preparing an order.' },
    { id: 'customer', keywords: ['customer','client','buyer'], title: 'Customers', route: '/reseller/customers', answer: 'Open Customers, add the customer with permission, and verify the name, phone, and complete delivery address before assigning products.' },
    { id: 'product', keywords: ['product','catalog','item','stock','buy'], title: 'Products and buying price', route: '/catalog', answer: 'Browse approved products in the Catalog. Your Reseller buying price and available quantity are shown before you add an item to the cart.' },
    { id: 'profit', keywords: ['profit','income','earn','earning','sell price','selling price','margin','bulk','piece'], title: 'Reseller earnings', route: '/cart', answer: 'Set your customer selling price in the product or cart view. Estimated profit is customer total minus your buying subtotal and the capped 1% system fee (minimum ₱3, maximum ₱50), before delivery, marketing, returns, and taxes.' },
    { id: 'order', keywords: ['order','checkout','cart','place order'], title: 'Place an order', route: '/cart', answer: 'Assign a saved customer, review quantity and selling price, wait for secure server price verification, then confirm checkout. The JOM HUB wallet pays the product subtotal plus the Reseller system fee; shipping is handled separately when shown.' },
    { id: 'delivery', keywords: ['delivery','shipping','shipped','tracking','receive'], title: 'Track delivery', route: '/reseller/orders', answer: 'Open Orders to view status, courier, tracking number, estimate, actual shipping fee, and dispatch proof. Confirm Delivery only after the items are actually received and checked.' },
    { id: 'wallet', keywords: ['wallet','balance','topup','top-up','cash in'], title: 'Reseller wallet', route: '/reseller/wallet', answer: 'Use Wallet to submit a top-up with a unique reference and proof, review your ledger, or request a withdrawal. Funds become usable only after Admin approval.' },
    { id: 'withdraw', keywords: ['withdraw','withdrawal','bank','payout'], title: 'Withdraw funds', route: '/reseller/wallet', answer: 'Save the correct payout account, wait 24 hours after changing it, then request at least ₱500. The daily limit is ₱100,000. Admin will schedule and record the transfer reference and proof.' },
    { id: 'report', keywords: ['report','sales report','inventory report','history'], title: 'Reseller reports', route: '/reseller/reports/sales', answer: 'Use Reports to review orders, wallet requests, inventory activity, and sales. Customer income is realized only after you record the customer payment as Paid.' }
  ],
  merchant: [
    { id: 'start', keywords: ['start','begin','activate','approval','onboarding','permit'], title: 'Merchant activation', route: '/merchant/account', answer: 'Complete your business profile and pickup address, upload a readable permit, choose a subscription, submit payment proof, and wait for Admin approval before listing products.' },
    { id: 'subscription', keywords: ['subscription','renew','expiry','expired','fee'], title: 'Merchant subscription', route: '/choose-subscription', answer: 'Open the subscription page to select or renew a plan and submit payment proof. Admin approval activates the subscription. Existing records remain available if a plan expires, but protected store actions may be limited.' },
    { id: 'product', keywords: ['product','upload','listing','item','stock','price','wholesale'], title: 'Product listing', route: '/merchant/products/new', answer: 'Create a product with truthful details, a real image, stock, retail and wholesale prices, packed measurements, and handling needs. Prohibited, illegal, counterfeit, unsafe, or misleading products cannot be posted.' },
    { id: 'profit', keywords: ['profit','income','earn','earning','proceeds','margin','fee'], title: 'Merchant proceeds', route: '/merchant/reports/sales', answer: 'Merchant proceeds are the completed product subtotal less the 3% completed-order platform fee. Your real profit must also subtract product cost, packaging, fulfillment, returns, and taxes.' },
    { id: 'order', keywords: ['order','customer order','processing','confirm'], title: 'Process an order', route: '/merchant/orders', answer: 'Open Customer Orders, verify inventory and locked prices, move an accepted order from Confirmed to Processing, then prepare the exact items and preserve packing evidence.' },
    { id: 'delivery', keywords: ['delivery','shipping','ship','tracking','courier','dispatch'], title: 'Dispatch an order', route: '/merchant/orders', answer: 'Before marking an order Shipped, enter the courier, tracking number, pickup time, delivery estimate, actual fee, and dispatch proof. Payout is released only after protected completion.' },
    { id: 'wallet', keywords: ['wallet','balance','topup','top-up'], title: 'Merchant wallet', route: '/merchant/wallet', answer: 'Use Wallet to review completed-order payouts, top-ups, withdrawals, and ledger entries. Always reconcile wallet activity with Sales and Ordered reports.' },
    { id: 'withdraw', keywords: ['withdraw','withdrawal','bank','payout'], title: 'Withdraw funds', route: '/merchant/wallet', answer: 'Save the correct payout account, wait 24 hours after changing it, then request at least ₱500 within the ₱100,000 daily limit. Admin schedules the payout and records proof after sending.' },
    { id: 'store', keywords: ['store hours','open store','close store','opening','closing'], title: 'Store availability', route: '/merchant/account', answer: 'Set optional opening and closing hours in Update Account. When automatic store hours are enabled, products become unavailable outside your schedule.' },
    { id: 'report', keywords: ['report','sales report','inventory report','history'], title: 'Merchant reports', route: '/merchant/reports/sales', answer: 'Use Reports to review sales, inventory, ordered items, top-ups, and withdrawals. Completed orders show the platform fee and recorded Merchant proceeds.' }
  ]
}

const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9%₱\s-]/g, ' ').replace(/\s+/g, ' ').trim()

export function getJomBitsSuggestions(role, pathname = '') {
  if (pathname.includes('/orders')) return role === 'merchant' ? ['What should I do with this order?', 'How do I ship an order?', 'How do order cases work?', 'Where is the tracking number?'] : ['How do I track delivery?', 'When should I confirm delivery?', 'How do I request help?', 'How do I print a receipt?']
  if (pathname.includes('/wallet')) return ['How do top-ups work?', 'How do withdrawals work?', 'How do I print a receipt?', 'Why is my balance pending?']
  if (pathname.includes('/products')) return role === 'merchant' ? ['How do I add a product?', 'What products are prohibited?', 'How should I set prices?', 'How do quantity offers work?'] : ['How do I choose a product?', 'How is my profit calculated?', 'Can I buy one piece?', 'How does bulk pricing work?']
  return role === 'merchant'
    ? ['How do I add a product?', 'How is Merchant profit calculated?', 'How do I ship an order?', 'How do withdrawals work?']
    : ['How do I place an order?', 'How is my profit calculated?', 'How do I track delivery?', 'How do withdrawals work?']
}

export function answerJomBits(question, role, pathname = '') {
  const query = normalize(question)
  const entries = [...(roleKnowledge[role] || []), ...shared]
  if (!query) return { title: 'Ask JOM Bits', answer: 'Enter a question about your JOM HUB workspace.' }
  let best = null
  let score = 0
  for (const entry of entries) {
    const candidate = entry.keywords.reduce((total, keyword) => {
      const clean = normalize(keyword)
      return total + (query.includes(clean) ? clean.split(' ').length + 1 : 0)
    }, 0)
    if (candidate > score) { best = entry; score = candidate }
  }
  if (best) return { ...best, answer: `${best.answer}${best.route && pathname.startsWith(best.route) ? ' You are already on the relevant page.' : ''}` }
  return { title: 'JOM HUB questions only', answer: `I can only help with JOM HUB ${role === 'merchant' ? 'Merchant' : 'Reseller'} processes, registration, schedules, account features, orders, products, wallet activity, reports, and security. Try one of the suggested questions.` }
}
