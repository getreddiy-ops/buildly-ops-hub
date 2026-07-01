import { Helmet } from "react-helmet-async";

const SITE = "https://fasttract.online";

type Props = {
  title: string;
  description: string;
  path: string;
  jsonLd?: object | object[];
  noindex?: boolean;
};

export function SEO({ title, description, path, jsonLd, noindex }: Props) {
  const url = `${SITE}${path}`;
  const ld = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex && <meta name="robots" content="noindex" />}
      {ld.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
}
