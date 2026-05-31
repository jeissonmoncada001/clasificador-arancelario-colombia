const Anthropic = require("@anthropic-ai/sdk");
const arancel = require("../../data/arancel.json");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un experto en clasificación arancelaria colombiana con profundo conocimiento del Sistema Armonizado (SA) y el Arancel de Aduanas de Colombia (Decreto 2153 de 2016 y sus modificaciones).

Tu tarea es clasificar productos en su partida arancelaria correcta siguiendo el proceso de dos pasos:

PASO 1 - IDENTIFICACIÓN DEL TIPO:
Determina la naturaleza del producto:
- ¿Es un animal vivo?
- ¿Es un producto de origen animal (carne, leche, huevos, pescado, cuero, etc.)?
- ¿Es un producto de origen vegetal (frutas, verduras, cereales, madera, etc.)?
- ¿Es un alimento procesado (conservas, bebidas, chocolate, etc.)?
- ¿Es un producto químico o farmacéutico?
- ¿Es un textil o prenda de vestir?
- ¿Es una máquina, aparato o equipo electrónico?
- ¿Es un vehículo o material de transporte?
- ¿Es un metal o manufactura metálica?
- ¿Es otro tipo de manufactura?

PASO 2 - CLASIFICACIÓN:
Con base en el tipo identificado, selecciona la partida arancelaria más específica y correcta del arancel colombiano.

RESPONDE SIEMPRE en el siguiente formato JSON exacto:
{
  "tipo_producto": "descripción del tipo identificado",
  "razonamiento": "explicación paso a paso de cómo llegaste a la clasificación",
  "partida_codigo": "XX.XX",
  "partida_descripcion": "descripción oficial de la partida",
  "seccion": "número de sección en romanos",
  "capitulo": "número de capítulo",
  "nivel_confianza": "alto|medio|bajo",
  "advertencias": "cualquier nota o advertencia sobre la clasificación (vacío si no hay)",
  "partidas_alternativas": []
}

Si el nivel de confianza es medio o bajo, incluye partidas alternativas con el mismo formato { "codigo": "XX.XX", "descripcion": "..." }.`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const { descripcion } = JSON.parse(event.body);
    if (!descripcion || descripcion.trim().length < 3) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Descripción del producto requerida" }),
      };
    }

    const arancelResumen = arancel.partidas
      .map((p) => `${p.codigo} | ${p.descripcion} | Tipo: ${p.tipo}`)
      .join("\n");

    const userMessage = `Clasifica el siguiente producto en el arancel colombiano:

PRODUCTO: "${descripcion}"

PARTIDAS DISPONIBLES EN EL ARANCEL:
${arancelResumen}

Analiza el producto y devuelve la clasificación en el formato JSON especificado.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = response.content[0].text.trim();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Respuesta IA no contiene JSON válido");

    const resultado = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, resultado }),
    };
  } catch (err) {
    console.error("Error classify:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Error al clasificar el producto", detalle: err.message }),
    };
  }
};
