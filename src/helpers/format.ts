import { DailyTrendingTopics, TrendingStory, TrendingTopic } from '../types/index.js';
import { ParseError } from '../errors/GoogleTrendsError.js';

// For future refrence and update: from google trends page rpc call response,
// 0	"twitter down"	The main trending search term.
// 1	null OR [newsUrl, source, imageUrl, [articles...]]	Image/article data (often null in current API responses).
// 2	"US"	Country code (where the trend is happening).
// 3	[1741599600]	Unix timestamp array - first element is when the trend started.
// 4	null OR [1741602000]	Unix timestamp array - trend end time (if available).
// 5	null	Unused (reserved for future data).
// 6	500000	Search volume index (estimated search interest for the term).
// 7	null	Unused (reserved for future data).
// 8	1000	Trend ranking score (higher means more popular).
// 9	["twitter down", "is twitter down", "is x down", ...]	Related searches (other queries that users searched alongside this term).
// 10	[11]	Unclear, possibly a category identifier.
// 11	[[3606769742, "en", "US"], [3596035008, "en", "US"]]	User demographics or trending sources, with numerical IDs, language ("en" for English), and country ("US" for United States).
// 12	"twitter down"	The original trending keyword (sometimes a duplicate of index 0).

export const extractJsonFromResponse = (text: string): DailyTrendingTopics | null => {
  const cleanedText = text.replace(/^\)\]\}'/, '').trim();
  try {
    const parsedResponse = JSON.parse(cleanedText);

    if (!Array.isArray(parsedResponse) || parsedResponse.length === 0) {
      throw new ParseError('Invalid response format: empty array');
    }
    const nestedJsonString = parsedResponse[0][2];

    if (!nestedJsonString) {
      throw new ParseError('Invalid response format: missing nested JSON');
    }
    const data = JSON.parse(nestedJsonString);

    if (!data || !Array.isArray(data) || data.length < 2) {
      throw new ParseError('Invalid response format: missing data array');
    }

    return updateResponseObject(data[1]);
  } catch (e: unknown) {
    if (e instanceof ParseError) {
      throw e;
    }
    throw new ParseError('Failed to parse response');
  }
};

const updateResponseObject = (data: unknown[]): DailyTrendingTopics => {
  if (!Array.isArray(data)) {
    throw new ParseError('Invalid data format: expected array');
  }

  const allTrendingStories: TrendingStory[] = [];
  const summary: TrendingTopic[] = [];

  data.forEach((item: unknown) => {
    if (Array.isArray(item)) {
      let articles: any[] = [];
      if (item[1] && Array.isArray(item[1]) && item[1].length > 3 && Array.isArray(item[1][3])) {
        articles = item[1][3].filter((article: any) => Array.isArray(article) && article.length >= 5).map((article: any) => ({
          title: String(article[0] || ''),
          url: String(article[1] || ''),
          source: String(article[2] || ''),
          time: String(article[3] || ''),
          snippet: String(article[4] || '')
        }));
      }

      const startTime = (Array.isArray(item[3]) && item[3].length > 0 && typeof item[3][0] === 'number')
        ? item[3][0]
        : 0;

      const endTime = (Array.isArray(item[4]) && item[4].length > 0 && typeof item[4][0] === 'number')
        ? item[4][0]
        : undefined;

      const story: TrendingStory = {
        title: String(item[0] || ''),
        traffic: String(item[6] || '0'),
        articles: articles,
        shareUrl: String(item[12] || ''),
        startTime,
        ...(endTime && { endTime })
      };

      if (item[1] && Array.isArray(item[1]) && item[1].length >= 3) {
        story.image = {
          newsUrl: String(item[1][0] || ''),
          source: String(item[1][1] || ''),
          imageUrl: String(item[1][2] || '')
        };
      }

      allTrendingStories.push(story);
      summary.push({
        title: story.title,
        traffic: story.traffic,
        articles: story.articles,
        startTime,
        ...(endTime && { endTime })
      });
    }
  });

  return { allTrendingStories, summary };
};
