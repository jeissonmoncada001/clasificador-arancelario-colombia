const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const { base64, mediaType } = JSON.parse(event.body);
    if (!base64 || !mediaType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Archivo requerido" }),
      };
    }

    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!supportedTypes.includes(mediaType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Tipo de archivo no soportado: ${mediaType}. Use JPG, PNG, WEBP o PDF.` }),
      };
    }

    const sourceType = mediaType === "application/pdf" ? "document" : "image";

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: sourceType,
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Extrae el nombre o descripción del producto principal de este documento (puede ser una factura, ficha técnica, etiqueta o cualquier documento comercial).

Devuelve SOLO el nombre/descripción del producto en texto plano, sin explicaciones adicionales.
Si hay varios productos, devuelve el más importante o el primero.
Si no puedes identificar un producto, responde: "No se pudo identificar el producto"`,
            },
          ],
        },
      ],
    });

    const descripcion = response.content[0].text.trim();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, descripcion }),
    };
  } catch (err) {
    console.error("Error extract:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Error al procesar el archivo", detalle: err.message }),
    };
  }
};
