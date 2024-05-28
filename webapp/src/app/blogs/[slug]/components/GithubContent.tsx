"use client";

import { fetchGithubFileContent } from "@/app/apis";
import React, { useCallback, useEffect, useState } from "react";
import Markdown from "react-markdown";
import style from "./GithubContent.module.scss"

type GithubContentProps = {
  fileName: string;
  category: string;
};

function GithubContent({ fileName, category }: GithubContentProps) {
  const [content, setContent] = useState<string>("");
  const [ready, setReady] = useState<boolean>(false);
  const fetchContent = useCallback(() => {
    fetchGithubFileContent(category, fileName).then((res) => {
      setContent(res);
      setReady(true);
    })
  }, [fileName, category]);
  useEffect(() => {
    fetchContent();
  }, [fetchContent])
  return ready && (
    <Markdown className={style.markdown}>{content}</Markdown>
  );
}

export default GithubContent;