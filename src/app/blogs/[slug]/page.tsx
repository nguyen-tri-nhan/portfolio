import Layout from "@/components/Layout";

export default function Page({ params }: { params: { slug: string } }) {
  const filename = decodeURIComponent(params.slug);
  return (
    <Layout>
      <h1>{filename}</h1>
    </Layout>
  );
}