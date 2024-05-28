import Layout from "@/components/Layout";
import GithubContent from "./components/GithubContent";

const category = "blogs";

export default function Page({ params }: { params: { slug: string } }) {
  const fileName = decodeURIComponent(params.slug);
  return (
    <Layout>
      <GithubContent fileName={fileName} category={category}/>
    </Layout>
  );
}
