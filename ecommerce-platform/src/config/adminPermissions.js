export const ADMIN_PERMISSIONS = [
  ['overview', 'Overview'], ['merchants', 'Merchants'], ['categories', 'Categories'],
  ['homepage', 'Homepage'], ['chats', 'Chat History'], ['support', 'Support Chats'], ['login_history', 'Login History'],
  ['reviews', 'Reviews & Ratings'], ['campaigns', 'Campaigns'], ['vouchers', 'Vouchers'], ['registrations', 'Registration Calendar'],
  ['payments', 'Payments'], ['topups', 'Top-Ups'], ['withdrawals', 'Withdrawals'],
  ['wallet', 'Platform Wallet'], ['sales', 'Sales'], ['subscriptions', 'Subscriptions'],
  ['reports', 'Reports']
]

export const canAccessAdmin = (profile, permission) => profile?.role === 'admin' || profile?.staff_access?.active && profile.staff_access.permissions?.includes(permission)

const permissionPaths = { overview: '/admin', merchants: '/admin/merchants', categories: '/admin/categories', homepage: '/admin/homepage', chats: '/admin/chats', support: '/admin/support-chats', login_history: '/admin/login-history', reviews: '/admin/reviews', campaigns: '/admin/campaigns', vouchers: '/admin/vouchers', registrations: '/admin/registrations', payments: '/admin/payments', topups: '/admin/topups', withdrawals: '/admin/withdrawals', wallet: '/admin/wallet', sales: '/admin/sales', subscriptions: '/admin/subscriptions', reports: '/admin/reports/sales' }
export const getAdminHomePath = (profile) => profile?.role === 'admin' ? '/admin' : permissionPaths[profile?.staff_access?.permissions?.[0]] || '/'
