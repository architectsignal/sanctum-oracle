export async function handler(event) {
  const method = event.httpMethod;
  if (method !== "POST" && method !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }
  let question;
  if (method === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON" })
      };
    }
    question = body.question || body.prompt;
  } else {
    question = event.queryStringParameters?.question;
  }
  if (!question) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "No question provided" })
    };
  }
  const answers = ["Yes.", "No.", "Maybe.", "It is certain.", "Ask again later."];
  const answer = answers[Math.floor(Math.random() * answers.length)];
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer })
  };
}