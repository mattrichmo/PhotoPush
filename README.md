# PhotoPush App

PhotoPush is a Node.js application designed to assist users in uploading and processing images to various image platforms. It utilizes various libraries and APIs to perform image-related tasks. This README.md file provides an overview of the app and its functionalities.

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Functionality](#functionality)
6. [Contributing](#contributing)
7. [License](#license)

## Introduction

The PhotoPush app is built on Node.js and provides functionalities to perform the following tasks:

1. **Image Uploading**: Upload images to the Pexels platform.
2. **Image Metadata**: Retrieve and display image metadata such as dimensions and file size.
3. **Image Description**: Generate image descriptions using the Replicate API from Salesforce.
4. **Image Keywords**: Use OpenAI API to generate keywords for the image.
5. **Batch Creation**: Create a batch of images on the Getty Images platform.

The app leverages several libraries and APIs, including:

- `dotenv`: For loading environment variables from a `.env` file.
- `fs`, `fs/promises`: For file system operations.
- `path`: For path manipulation.
- `chalk`: For colorful console output.
- `Jimp`: For image processing tasks.
- `Midjourney`: Custom library for internal purposes.
- `Replicate`: For generating image descriptions using AI.
- `OpenAI`: For generating image keywords using AI.
- `puppeteer`: For web scraping and browser automation.
- `sharp`: An alternative to Jimp for image processing.

## Prerequisites

Before running the PhotoPush app, ensure you have the following prerequisites:

1. Node.js and npm: Install Node.js and npm on your machine.
2. Node.js Libraries: Run `npm install` to install all the required libraries specified in the `package.json` file.
3. API Keys: Obtain the necessary API keys for Replicate and OpenAI and set them in a `.env` file as follows:

OPENAI_KEY=your_openai_api_key
REPLICATE_API_TOKEN=your_replicate_api_token


## Installation

1. Clone the repository:


git clone https://github.com/your-username/photopush.git
cd photopush


2. Install the dependencies:

npm install


## Usage

To use the PhotoPush app, you can run the following command:



node pp.mjs


This will execute the `PushImages` function, which will process images, gather their information, and upload them to the Pexels platform. The uploaded images will be displayed on the console along with their metadata, descriptions, and keywords.

## Functionality

### Image Uploading (Pexels)

The app uses Puppeteer to automate the process of uploading images to the Pexels platform. Images from the `./img/toUpload` folder are uploaded to Pexels one by one. The function `uploadToPexels` handles this task.

### Image Metadata

Image metadata, including dimensions and file size, is extracted using the `sharp` library. The function `getImgDimensions` retrieves this information.

### Image Description

The `getDescription` function utilizes the Replicate API to generate image descriptions for each uploaded image.

### Image Keywords

To generate keywords for the images, the app uses the OpenAI API. The `getKeywords` function obtains keywords for each uploaded image.

### Batch Creation (Getty Images)

The app creates a batch of images on the Getty Images platform using Puppeteer. The `createBatch` function handles this task.

## Contributing

Contributions to the PhotoPush app are welcome. If you find any issues or want to add new features, feel free to create a pull request.

## License

The PhotoPush app is open-source software licensed under the [MIT License](LICENSE). Feel free to use and modify the code as per the terms of the license.

