import { load } from 'cheerio';
import axios from 'axios';

import {
  MovieParser,
  TvType,
  IMovieInfo,
  IEpisodeServer,
  StreamingServers,
  ISource,
  IMovieResult,
  ISearch,
} from '../../models';
import { MixDrop, AsianLoad, StreamTape, StreamSB } from '../../extractors';

class DramaCool extends MovieParser {
  override readonly name = 'DramaCool';
  protected override baseUrl = 'https://www1.dramacool.cr';
  protected override logo =
    'https://play-lh.googleusercontent.com/IaCb2JXII0OV611MQ-wSA8v_SAs9XF6E3TMDiuxGGXo4wp9bI60GtDASIqdERSTO5XU';
  protected override classPath = 'MOVIES.DramaCool';
  override supportedTypes = new Set([TvType.MOVIE, TvType.TVSERIES]);

  override search = async (query: string, page: number = 1): Promise<ISearch<IMovieResult>> => {
    const searchResult: ISearch<IMovieResult> = {
      currentPage: page,
      hasNextPage: false,
      results: [],
    };

    try {
      const { data } = await axios.get(
        `${this.baseUrl}/search?keyword=${query.replace(/[\W_]+/g, '-')}&page=${page}`
      );

      const $ = load(data);

      const navSelector = 'ul.pagination';

      searchResult.hasNextPage =
        $(navSelector).length > 0 ? !$(navSelector).children().last().hasClass('selected') : false;

      $('div.block > div.tab-content > ul.list-episode-item > li').each((i, el) => {
        searchResult.results.push({
          id: $(el).find('a').attr('href')?.slice(1)!,
          title: $(el).find('a > h3').text(),
          url: `${this.baseUrl}${$(el).find('a').attr('href')}`,
          image: $(el).find('a > img').attr('data-original'),
        });
      });
      return searchResult;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchMediaInfo = async (mediaId: string): Promise<IMovieInfo> => {
    const realMediaId = mediaId;
    if (!mediaId.startsWith(this.baseUrl)) mediaId = `${this.baseUrl}/${mediaId}`;

    const mediaInfo: IMovieInfo = {
      id: '',
      title: '',
    };
    try {
      const { data } = await axios.get(mediaId);

      const $ = load(data);

      mediaInfo.id = realMediaId;
      mediaInfo.title = $('.info > h1:nth-child(1)').text();
      mediaInfo.otherNames = $('.other_name > a')
        .map((i, el) => $(el).text().trim())
        .get();
      mediaInfo.image = $('div.details > div.img > img').attr('src');
      // get the 3rd p tag
      mediaInfo.description = $('div.details div.info p:nth-child(6)').text();
      mediaInfo.releaseDate = this.removeContainsFromString(
        $('div.details div.info p:contains("Released:")').text(),
        'Released'
      );

      mediaInfo.episodes = [];
      $('div.content-left > div.block-tab > div > div > ul > li').each((i, el) => {
        mediaInfo.episodes?.push({
          id: $(el).find('a').attr('href')?.split('.html')[0].slice(1)!,
          title: $(el).find('h3').text().replace(mediaInfo.title.toString(), '').trim(),
          episode: parseFloat(
            $(el).find('a').attr('href')?.split('-episode-')[1].split('.html')[0].split('-').join('.')!
          ),
          releaseDate: $(el).find('span.time').text(),
          url: `${this.baseUrl}${$(el).find('a').attr('href')}`,
        });
      });
      mediaInfo.episodes.reverse();

      return mediaInfo;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchEpisodeSources = async (
    episodeId: string,
    server: StreamingServers = StreamingServers.AsianLoad
  ): Promise<ISource> => {
    if (episodeId.startsWith('http')) {
      const serverUrl = new URL(episodeId);
      switch (server) {
        case StreamingServers.AsianLoad:
          return {
            ...(await new AsianLoad().extract(serverUrl)),
          };
        case StreamingServers.MixDrop:
          return {
            sources: await new MixDrop().extract(serverUrl),
          };
        case StreamingServers.StreamTape:
          return {
            sources: await new StreamTape().extract(serverUrl),
          };
        case StreamingServers.StreamSB:
          return {
            sources: await new StreamSB().extract(serverUrl),
          };
        default:
          throw new Error('Server not supported');
      }
    }

    if (!episodeId.includes('.html')) episodeId = `${this.baseUrl}/${episodeId}.html`;

    try {
      const { data } = await axios.get(episodeId);

      const $ = load(data);

      let serverUrl = '';
      switch (server) {
        // asianload is the same as the standard server
        case StreamingServers.AsianLoad:
          serverUrl = `https:${$('.Standard').attr('data-video')}`;
          if (!serverUrl.includes('asian')) throw new Error('Try another server');
          break;
        case StreamingServers.MixDrop:
          serverUrl = $('.mixdrop').attr('data-video')!;
          if (!serverUrl.includes('mixdrop')) throw new Error('Try another server');
          break;
        case StreamingServers.StreamTape:
          serverUrl = $('.streamtape').attr('data-video')!;
          if (!serverUrl.includes('streamtape')) throw new Error('Try another server');
          break;
        case StreamingServers.StreamSB:
          serverUrl = $('.streamsb').attr('data-video')!;
          if (!serverUrl.includes('stream')) throw new Error('Try another server');
          break;
      }

      return await this.fetchEpisodeSources(serverUrl, server);
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  override fetchEpisodeServers(episodeId: string, ...args: any): Promise<IEpisodeServer[]> {
    throw new Error('Method not implemented.');
  }

  private removeContainsFromString = (str: string, contains: string) => {
    contains = contains.toLowerCase();
    return str.toLowerCase().replace(/\n/g, '').replace(`${contains}:`, '').trim();
  };
}

// (async () => {
//   const drama = new Dramacool();
//   const search = await drama.search('vincenzo');
//   const mediaInfo = await drama.fetchMediaInfo(search.results[0].id);
//   // const sources = await drama.fetchEpisodeSources(mediaInfo.episodes![0].id);
//   console.log(mediaInfo);
// })();

export default DramaCool;
