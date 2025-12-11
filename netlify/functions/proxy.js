const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

exports.handler = async function (event, context) {
  try {
    const proxiedPath = event.path.replace(
      /^\/\.netlify\/functions\/proxy/,
      ""
    );

    const targetUrl = `https://apipubaws.tcbs.com.vn${proxiedPath}${
      event.rawQuery ? `?${event.rawQuery}` : ""
    }`;

    const headers = {
      Accept: "application/json",
      Referer: "https://tcinvest.tcbs.com.vn/",
    };

    const resp = await fetch(targetUrl, { headers });
    const body = await resp.text();

    return {
      statusCode: resp.status,
      headers: {
        "Content-Type": resp.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
