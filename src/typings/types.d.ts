import * as puppeteer from "puppeteer";

export interface IOptions extends puppeteer.ScreenshotOptions {
  encoding?: "base64"|"utf8"|"binary"|"hex";
  background?: string;
  width?: number;
  height?: number;
}

export interface IOptionsPngShorthand extends IOptions  {
  type?: never;
  quality?: never;
}

export interface IOptionsJpegShorthand extends IOptions  {
  type?: never;
}
