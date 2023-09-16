const express = require("express");
const multer = require("multer");
const app = express();
const port = 3000;
const { createWorker } = require('tesseract.js');
const openai = require('openai');
const apiKey = process.env.OPENAI_API_KEY; // Load API key from environment variable
const api = new openai({ apiKey:apiKey });

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


async function performOCR(pdfBuffer) {
  try {
    const worker = await createWorker();

    // Initialize the worker with English language data
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    // Perform OCR on the PDF buffer
    const { data: { text } } = await worker.recognize(pdfBuffer);

    // Terminate the worker
    await worker.terminate();

    return text;
  } catch (error) {
    console.error('OCR Error:', error);
    throw error;
  }
}

async function chatWithGPT(extractedText) {
    const completion = await api.chat.completions.create({
        messages: [{
            role: 'system',
            content: 'You are a helpful assistant.',
          },{ role: 'user', content: extractedText },
        ],
        model: 'gpt-3.5-turbo',
      });
    
      return completion.choices[0].message.content
  }


app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html"); // Change "index.html" to the actual name of your HTML file
  });

app.post("/upload", upload.single("pdfFile"), async (req, res) => {
    try {
        const pdfBuffer = req.file.buffer;
        
        const extractedText = await performOCR(pdfBuffer);
        let fullPrompt = `please read the medical report and suggest how I can improve: ${extractedText}`
        
        const chatResponse = await chatWithGPT(fullPrompt);

        res.json({ text: chatResponse });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred" });
    }
});

app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`);
});
