import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import { TelegramClient, html } from '@mtcute/node'
import { config } from 'dotenv';

config();
const main = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.setViewport({ width: 1280, height: 720 });
  await page.goto('https://www.youtube.com/@SuperKratkiy/videos', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'youtube.png' });

  const $ = cheerio.load(await page.content());
  const titles = $('#video-title').map((_, element) => $(element).text()).get();
  const images = $('yt-image img').map((_, element) => $(element).attr('src')).get();
  const links = $('a#video-title-link').map((_, element) => $(element).attr('href')).get();

  const videos: any[] = [];
  for (let i = 0; i < titles.length; i++) {
    try {
      const title = titles[i];
      const image = images[i];
      const link = links[i];

      await page.goto(`https://www.youtube.com${link}`);
      const description = await page.$eval('#attributed-snippet-text', element => element.textContent);

      const name = description?.split('"')[1]?.split('"')[0].replace('"', '') || (description?.split('фильма')[1]?.split('"')[0].replace('"', '').split("(")[0] || null);
      const year = description?.split('(')[1]?.split(')')[0] || null;

      videos.push({
        title,
        realTitle: name,
        year,
        link,
        image,
      });
    } catch (error) {
      console.error(error);
    }
  }

  await browser.close();

  const tg = new TelegramClient({
    apiId: parseInt(process.env.API_ID || '') || 0,
    apiHash: process.env.API_HASH || '',
  })
  tg.run({
    phone: () => tg.input('Phone > '),
    code: () => tg.input('Code > '),
    password: () => tg.input('Password > ')
  }, async (self) => {
    console.log(`Logged in as ${self.displayName}`)
    const peer = await tg.resolvePeer("bestmoviesdotcom");

    for (const video of videos) {
      await tg.sendText(peer, html`<b>${video.realTitle} (${video.year})</b><br/><br/>${video.title}<br/><br/><b>Пересказ:</b> https://youtube.com${video.link} <br/><br/><b>Резка:</b> https://rezka.ag/search/?do=search&subaction=search&q=${video.realTitle.replace(" ", "+")}+${video.year}`);
    }
  })
}

main().catch(console.error);