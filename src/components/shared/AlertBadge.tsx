const STYLES: Record<string, string> = {
  'Gone Dark': 'bg-red-100 text-red-700',
  'Sharp Decline': 'bg-orange-100 text-orange-700',
  'Moderate Decline': 'bg-yellow-100 text-yellow-700',
  'Rising Star': 'bg-green-100 text-green-700',
  'New Relationship': 'bg-blue-100 text-blue-700',
}

export default function AlertBadge({ category }: { category: string }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STYLES[category] || 'bg-gray-100 text-gray-600'}`}
    >
      {category}
    </span>
  )
}
