export default function Page({ params }: { params: { slug: string } }) {
  const filename = decodeURIComponent(params.slug);
  return <div>My Post: {filename}</div>
}