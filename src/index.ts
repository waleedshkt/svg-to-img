import * as puppeteer from "puppeteer";
import { ScreenshotOptions } from "puppeteer";
import { defaultOptions } from "./constants";
import { getFileTypeFromPath, getSvgNaturalDimensions, embedSvgInBody, stringifyFunction, setStyle } from "./helpers";
import { IOptions, IOptionsPngShorthand, IOptionsJpegShorthand } from "./typings/types";

let browserDestructionTimeout: any; // TODO: add proper typing
let browserInstance: puppeteer.Browser|undefined;

const getBrowser = async () => {
  clearTimeout(browserDestructionTimeout);

  return (browserInstance = browserInstance ? browserInstance : await puppeteer.launch());
};

const scheduleBrowserForDestruction = () => {
  clearTimeout(browserDestructionTimeout);
  browserDestructionTimeout = setTimeout(() => {
    /* istanbul ignore next */
    if (browserInstance) {
      browserInstance.close();
      browserInstance = undefined;
    }
  }, 1000);
};

const convertSvg = async (input: Buffer|string, output: IOptions): Promise<Buffer|string> => {
  // Convert buffer to string
  const svg = Buffer.isBuffer(input) ? (input as Buffer).toString("utf8") : input;
  const screenshotOptions = {...defaultOptions, ...output};
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Get the natural dimensions of the SVG if they were not specified
  if (!screenshotOptions.width && !screenshotOptions.height) {
    const naturalDimensions = await page.evaluate(stringifyFunction(getSvgNaturalDimensions, svg));

    screenshotOptions.width = naturalDimensions.width;
    screenshotOptions.height = naturalDimensions.height;
  }

  // Do not disable javascript otherwise the onload event won't work for images
  // Offline mode is enabled to prevent SVGs from sending requests over the network
  await page.setOfflineMode(true);
  await page.setViewport({ height: 1, width: 1 });
  await page.evaluate(stringifyFunction(embedSvgInBody, svg, screenshotOptions.width, screenshotOptions.height));

  // Infer the file type from the file path if no type is provided
  if (!output.type && screenshotOptions.path) {
    const fileType = getFileTypeFromPath(screenshotOptions.path);

    if (["jpeg", "png"].includes(fileType)) {
      screenshotOptions.type = fileType as ScreenshotOptions["type"];
    }
  }

  // The quality option is only used with JPEGs
  if (screenshotOptions.type !== "jpeg") {
    delete screenshotOptions.quality;
  }

  await page.evaluate(stringifyFunction(setStyle, "body", {
    margin: "0px",
    padding: "0px"
  }));

  if (screenshotOptions.type === "jpeg") {
    await page.evaluate(stringifyFunction(setStyle, "html", {
      "background-color": "#fff"
    }));
  }

  if (screenshotOptions.background) {
    await page.evaluate(stringifyFunction(setStyle, "body", {
      "background-color": screenshotOptions.background
    }));
  }

  const screenshot = await page.screenshot(screenshotOptions);

  page.close(); // Close tab asynchronously (no await)
  scheduleBrowserForDestruction();

  if (screenshotOptions.encoding) {
    return screenshot.toString(screenshotOptions.encoding);
  }

  return screenshot;
};

const to = (input: Buffer|string) => {
  return async (output: IOptions): Promise<Buffer|string> => {
    return convertSvg(input, output);
  };
};

const toPng = (input: Buffer|string) => {
  return async (output?: IOptionsPngShorthand): Promise<Buffer|string> => {
    const defaultShorthandOptions: IOptions = {
      type: "png"
    };

    const options = {...defaultShorthandOptions, ...output};

    return convertSvg(input, options);
  };
};

const toJpeg = (input: Buffer|string) => {
  return async (output?: IOptionsJpegShorthand): Promise<Buffer|string> => {
    const defaultShorthandOptions: IOptions = {
      type: "jpeg"
    };

    const options = {...defaultShorthandOptions, ...output};

    return convertSvg(input, options);
  };
};

export const from = (input: Buffer|string) => {
  return {
    to: to(input),
    toPng: toPng(input),
    toJpeg: toJpeg(input)
  };
};
