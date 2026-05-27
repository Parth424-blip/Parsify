const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const Groq = require("groq-sdk");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();

const port = process.env.PORT || 3000;

// Groq Client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Supabase Client
const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Upload Route
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
                  url: `data:${req.file.mimetype};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
      });

      // Raw AI response
      const rawContent = response.choices[0].message.content;

      // Clean markdown formatting
      const cleanedResponse = rawContent
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      // Parse JSON
      const parsedData = JSON.parse(cleanedResponse);

      // Upload image to Supabase Storage
      const fileName = `${Date.now()}-${req.file.originalname}`;

      const { data: storageData, error: storageError } =
        await supabaseClient.storage
          .from("Receipts")
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
          });

      if (storageError) {
        throw storageError;
      }

      // Get Public URL
      const {
        data: { publicUrl },
      } = supabaseClient.storage.from("Receipts").getPublicUrl(fileName);

      // Insert into Database
      const { data, error } = await supabaseClient.from("receipts").insert({
        vendor_name: parsedData.vendor_name,
        amount: parsedData.amount,
        date: parsedData.date,
        category: parsedData.category,
        currency: parsedData.currency,
        filename: req.file.originalname,
        file_url: publicUrl,
      });

      if (error) {
        throw error;
      }

      console.log(parsedData);

      res.status(200).json({
        success: true,
        extracted_data: parsedData,
        file_url: publicUrl,
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
