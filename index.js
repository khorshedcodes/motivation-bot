const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

require("dotenv").config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.PAGE_ID;

// Get a random quote
async function getRandomQuote() {
  try {
    const response = await axios.get("https://zenquotes.io/api/random");
    return {
      quote: response.data[0].q,
      author: response.data[0].a,
    };
  } catch (error) {
    console.error("Error fetching quote:", error);
    return { quote: "Failed to retrieve quote.", author: "" };
  }
}

// Get a random image URL from Picsum
function getRandomImageUrl(width = 1350, height = 1080) {
  return `https://picsum.photos/${width}/${height}`;
}

// Create image with quote overlay
async function createMotivationImage() {
  const width = 1350;
  const height = 1080;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Get quote and image
  const quote = await getRandomQuote();
  const imageUrl = getRandomImageUrl(width, height);

  // Download the background image
  const imageResponse = await axios.get(imageUrl, {
    responseType: "arraybuffer",
  });
  const background = await loadImage(imageResponse.data);

  // Draw background image
  ctx.drawImage(background, 0, 0, width, height);

  // Overlay semi-transparent black rectangle for readability
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, width, height);

  // Quote text styling
  ctx.font = "bold 50px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";

  // Wrap long text
  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = text.split(" ");
    const lines = [];
    let line = "";

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    let newY = y;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, newY);
      newY += lineHeight;
    }
  };

  // Draw quote
  wrapText(ctx, `"${quote.quote}"`, width / 2, 400, width - 200, 60);

  // Draw author
  ctx.font = "italic 35px sans-serif";
  ctx.fillText(`— ${quote.author}`, width / 2, 600);

  // Save image
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync("output.png", buffer);
  console.log("Image saved as output.png");

  // At the end of createMotivationImage()
  await postToFacebook(PAGE_ACCESS_TOKEN, PAGE_ID);
}

createMotivationImage();

async function postToFacebook(pageAccessToken, pageId) {
  const imagePath = "./output.png";

  try {
    // Create form data and append image
    const form = new FormData();
    const imageStream = fs.createReadStream(imagePath);
    form.append("source", imageStream, {
      filename: "quote.png",
      contentType: "image/png",
    });
    form.append(
      "caption",
      "Here's your daily dose of inspiration 💪 #MotivationalQuote"
    );
    form.append("access_token", pageAccessToken); // Important!

    // Post to Facebook Graph API
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${pageId}/photos`,
      form,
      {
        headers: form.getHeaders(), // Set correct Content-Type (multipart/form-data)
      }
    );

    console.log("Posted to Facebook!");
    return response.data;
  } catch (error) {
    console.error(
      "Error posting to Facebook:",
      error.response?.data || error.message
    );
  }
}
