const express = require("express");
const multer = require("multer");
const app = express();
const port = 3000 || process.env.PORT;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.post("/upload", (req, res) => {
  const upload = multer().single("file"); // 'file' is the name of the form field
  upload(req, res, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error uploading file");
    }
    res.status(200).send({
      message: "File uploaded successfully",
      mimetype: req.file.mimetype,
      name: req.file.originalname,
    });
  });
  console.log("File upload endpoint hit");
});
