declare module "word-extractor" {
  class WordExtractor {
    extract(input: { buffer: Buffer }): Promise<{
      getBody(): string;
      getHeaders(): string;
      getFootnotes(): string;
      getEndnotes(): string;
    }>;
  }
  export default WordExtractor;
}
