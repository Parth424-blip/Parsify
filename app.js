const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const Groq = require("groq-sdk");

dotenv.config();

const app = express();

const port = process.env.PORT || 3000;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.post("/upload", (req, res) => {
  const upload = multer().single("file");

  upload(req, res, async (err) => {
    try {
      if (err) {
        console.error(err);
        return res.status(500).send("Error uploading file");
      }

      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }

      // Convert image buffer to base64
      const base64Data = req.file.buffer.toString("base64");

      // Vision request to Groq
      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
Return only a JSON object with these fields:
vendor_name,
amount,
date,
category,
currency

No explanation.
No markdown.
Only valid JSON.
                `,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`,
                },
              },
            ],
          },
        ],
      });

      // Raw AI response
      const rawContent = response.choices[0].message.content;

      // Remove markdown backticks
      const cleanedResponse = rawContent
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      // Convert JSON string -> JS object
      const parsedData = JSON.parse(cleanedResponse);

      console.log(parsedData);

      res.status(200).json({
        success: true,
        filename: req.file.originalname,
        data: parsedData,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Something went wrong",
        error: error.message,
      });
    }
  });
});
