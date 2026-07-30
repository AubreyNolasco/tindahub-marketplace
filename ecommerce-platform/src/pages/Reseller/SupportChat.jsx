import { useAuth } from '../../contexts/AuthContext'
import SupportChatThread from '../../components/support/SupportChatThread'

export default function SupportChat() {
  const { user } = useAuth()
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Chat Support</h1>
      <p className="text-sm text-ink/50 mb-6">Message Admin directly for help with your account.</p>
      {user && <SupportChatThread threadUserId={user.id} title="Admin Support" subtitle="Usually replies within the day" />}
    </div>
  )
}
