export default function Spinner({ size = 32 }) {
  return (
    <div
      className="animate-spin rounded-full border-4 border-teal-100 border-t-teal-500"
      style={{ width: size, height: size }}
    />
  )
}
