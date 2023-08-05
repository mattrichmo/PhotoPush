import dotenv from 'dotenv';
import fs from 'fs';
import fsp from "fs/promises";
import path from 'path';
import chalk from 'chalk';
import Jimp from 'jimp';
import { Midjourney } from "./libs/index.js";
import Replicate from "replicate";
import { Configuration, OpenAIApi } from 'openai';
import puppeteer from 'puppeteer';
import sharp from 'sharp'; // Using sharp as an alternative to Jimp
dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);


const newImages = [
];


const createImgObjectsFromFolder = async () => {
  const folderPath = './img/toUpload';
  const imgObjects = [];

  try {
    const files = await fsp.readdir(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = await fsp.stat(filePath);
      if (stats.isFile() && ['.png', '.jpg', '.gif', '.jpeg', '.JPG'].includes(path.extname(file))) {
        const imgObject = {
          fileName: file,
          path: folderPath,
        };
        imgObjects.push(imgObject); // Push into imgObjects array
        console.log('Image file:', file, 'Path:', folderPath);
      }
    }
  } catch (err) {
    console.error('Error reading folder:', err);
  }

  return imgObjects; // Resolve the promise with imgObjects array
};

const getImgDimensions = async (imgObject) => {
  const filePath = path.join(imgObject.path, imgObject.fileName);
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    imgObject.width = metadata.width;
    imgObject.height = metadata.height;

    // Get file size using fsp.stat instead of metadata.size
    const stats = await fsp.stat(filePath);
    imgObject.dataSize = stats.size; // size in bytes

    const tableData = {
      Image: imgObject.fileName,
      Dimensions: `Width - ${imgObject.width}, Height - ${imgObject.height}`,
      Size: `${(imgObject.dataSize / (1024 * 1024)).toFixed(2)} MB`,
    };

    console.table(tableData);
  } catch (err) {
    console.error(chalk.red('Error reading image:', err));
  }
};


const getDescription = async (imgObject) => {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  try {
    const modelVersion = "salesforce/blip:2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746";

    const imagePath = path.join(imgObject.path, imgObject.fileName);
    const mimeType = 'image/jpg';

    const imageBuffer = await fsp.readFile(imagePath);
    const base64 = imageBuffer.toString('base64');
    const dataURI = `data:${mimeType};base64,${base64}`;

    const output = await replicate.run(modelVersion, {
      input: {
        image: dataURI,
      },
    });

    imgObject.imgDescription = output;

    console.log('Output:', imgObject.imgDescription);

  } catch (err) {
    console.error('Error:', err);
  }
};
const callOpenAI = async (model, messages, functions, functionCall, temperature, maxTokens) => {
  let retries = 0;
  const maxRetries = 10;
  const backoffFactor = 1;

  while (retries < maxRetries) {
      try {
          const completion = await openai.createChatCompletion({
              model: model,
              messages: messages,
              functions: functions,
              function_call: functionCall,
              temperature: temperature,
              max_tokens: maxTokens,
          });

          const responseText = completion.data.choices[0].message.function_call.arguments;

          // Log raw response for debugging
          //console.log(chalk.red('\n\n#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#\n\n'))
          //console.log(chalk.yellow(`Raw Response from AI: ${responseText}`));
          //console.log(chalk.red('\n\n#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#X#\n\n'))

          // Check if the response is a valid JSON
          try {
              JSON.parse(responseText);
              return responseText;
          } catch (jsonError) {
              console.warn(chalk.red("The AI Bot didn't follow instructions on outputting to JSON, so retrying again."));
          }
      } catch (error) {
          console.error(`An error occurred: ${error.statusCode} - ${error.message}`);
          //console.trace(error); // Log the full stack trace of the error

          const wait = retries * backoffFactor * 5000;
          console.log(`Retrying in ${wait / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, wait));
          retries += 1;
      }
  }

  throw new Error('Maximum retries reached');
};
const getKeywords = async (imgObject) => {
  const gettyKeywordSchema = {
    type: "object",
    properties: {
      gettyKeywords: {
        type: "array",
        items: {
          type: "string",
          description: "The keyword to search for in Getty Images"
        }
      }
    }
  };
  const responseText = await callOpenAI(
    "gpt-3.5-turbo-0613",
    [
      { "role": "system", "content": "You are an AI assistant helping a user generate keywords for images. This is for Getty Images which only uses specific keywords and you can't choose outside that. So be precise." },
      { "role": "user", "content": `Please generate 20 keywords for the image: ${imgObject.imgDescription}` }
    ],
    [{ "name": "Generate_keywords", "parameters": gettyKeywordSchema }],
    { "name": "Generate_keywords" },
    0.9,
    3700
  );
  const response = JSON.parse(responseText);
  const gettyKeywords = response.gettyKeywords;
  imgObject.gettyKeywords = gettyKeywords;
  console.log(`Getty Keywords:\n${imgObject.gettyKeywords.join('  ')}`);
};

const createBatch = async (imgObjects) => {
  try {
    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
    });
    const page = await browser.newPage();

    // Load cookies from the cookies.json file
    const cookies = fs.readFileSync('./cookies/esp.gettyimages.com.cookies.json', 'utf8');
    const parsedCookies = JSON.parse(cookies);
    await page.setCookie(...parsedCookies);

    // Navigate to the specified URL
    const url = 'https://esp.gettyimages.com/contribute/batches?assetTypes=&dateFrom=2022-07-24&dateTo=2023-07-25&page=1&pageSize=10&sortColumn=created_at&sortOrder=DESC';
    await page.goto(url);

    // Click the 'Create Batch' button
    await page.waitForSelector('button[data-cy="create-batch-button"]');
    const createBatchButton = await page.$('button[data-cy="create-batch-button"]');
    await createBatchButton.click();

    // Wait for a while before clicking the second button (You can adjust the time in milliseconds)
    await page.waitForTimeout(3000);

    // Click the 'Create' button
    await page.waitForSelector('button[data-cy="create-batch-confirm-button"]');
    const createConfirmButton = await page.$('button[data-cy="create-batch-confirm-button"]');
    await createConfirmButton.click();

    // Wait for a while before clicking the second button (You can adjust the time in milliseconds)
    await page.waitForTimeout(1000);

    // Iterate through each image and upload it
    for (const imgObject of imgObjects) {
      await page.waitForSelector('button[data-cy="upload-button-file-input"]');
      const uploadDeviceButton = await page.$('button[data-cy="upload-button-file-input"]');
      await uploadDeviceButton.click();

      // Wait for file input to be available
      await page.waitForSelector('input[type="file"]');

      // Set the file input value to the image file path
      await page.evaluate((imgObject) => {
        const fileInput = document.querySelector('input[type="file"]');
        fileInput.value = imgObject.path + '/' + imgObject.fileName;
      }, imgObject);

      // Wait for the image to be uploaded
      await page.waitForTimeout(1000); // Adjust the time as needed

      // Assuming there is a button to confirm the upload, locate and click it
      await page.waitForSelector('button[data-cy="confirm-upload-button"]');
      const confirmUploadButton = await page.$('button[data-cy="confirm-upload-button"]');
      await confirmUploadButton.click();

      // Wait for the image to finish processing (adjust the time as needed)
      await page.waitForTimeout(5000); // You may need to adjust this based on the actual processing time

      // After the image is processed, you can capture any success message, error message, or other relevant information.
      // You may need to wait for a specific selector or check the page for certain elements to determine the upload status.
    }

    // Close the browser
    // await browser.close();
  } catch (error) {
    console.error('Error:', error);
  }
};
const uploadToPexels = async () => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
    });

    const page = await browser.newPage();

    // Load cookies from the cookies.json file
    const cookies = fs.readFileSync('./cookies/www.pexels.com.cookies.json', 'utf8');
    const parsedCookies = JSON.parse(cookies);
    await page.setCookie(...parsedCookies);

    // Navigate to the specified URL
    await page.goto('https://www.pexels.com/upload/');

    // Wait for the page to load and the "Use Auth" button to appear
    await page.waitForSelector('a.useAuth_hideWhenSignedOut__hAWWD > span > span');

    // Click the "Use Auth" button
    await page.click('a.useAuth_hideWhenSignedOut__hAWWD > span > span');

    // Wait for the "Upload" button to appear
    await page.waitForSelector('label');

    // Add a timeout of 2 seconds before clicking the "Upload" button
    await page.waitForTimeout(2000);

    // Click the "Upload" button
    await page.click('label');

    // Add a timeout of 5 seconds after clicking the "Upload" button before closing the browser
    await page.waitForTimeout(5000);


    // Iterate through each image object and upload the image
    for (const imgObject of imgObjects) {
      console.log('Uploading image file:', imgObject.fileName);
      const filePath = path.join(imgObject.path, imgObject.fileName);
      
      // Set the file input value to the file path
      const fileInput = await page.$('input[type="file"]');
      await fileInput.uploadFile(filePath);

      // Wait for the image to upload (you may need to adjust the waiting time as per your needs)
      await page.waitForTimeout(5000);
    }

    // Finally, close the browser when you're done with the upload process
    await browser.close();
  } catch (error) {
    console.error('Error:', error);
  }
};

const PushImages = async () => {
  const dataSizeFormatter = (value) => `${(value / (1024 * 1024)).toFixed(2)} MB`;
  const imgDescriptionFormatter = (value) => value || '-';
  const gettyKeywordsFormatter = (value) => value ? value.join(', ') : '-';

  const imgObjects = await createImgObjectsFromFolder();
  const imageStrings = [];

  // Process all images and gather their information asynchronously
  await Promise.all(imgObjects.map(async (imgObject, index) => {
    await getImgDimensions(imgObject);
    await getDescription(imgObject);
    await getKeywords(imgObject);
    newImages.push(imgObject); // Push the updated imgObject into newImages array

    const imageString = `${chalk.green.bold(`[${index + 1}]`)} ${chalk.yellow.bold(`${imgObject.fileName} | ${imgObject.path}`)}
    ${chalk.bold("Width:")} ${imgObject.width}       ${chalk.bold("Height:")} ${imgObject.height}       ${chalk.bold("Size:")} ${dataSizeFormatter(imgObject.dataSize)}
    ${chalk.bold("Keywords:")} ${gettyKeywordsFormatter(imgObject.gettyKeywords)}
    
`;
    imageStrings.push(imageString);
  }));

  await createBatch(imgObjects);
  //await uploadToPexels(imgObjects);

  console.log(imageStrings.join(''));

  return newImages;
};


PushImages();

