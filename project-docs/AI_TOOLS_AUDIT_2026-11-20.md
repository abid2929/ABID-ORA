# Abidora AI: Web Search, Live Crypto ও Image — Audit Report
২০ নভেম্বর ২০২৬ (ঢাকা সময় রাত প্রায় ১:৪০)

নিয়ম: যা আসল API-তে চালিয়ে দেখা, তা "পরীক্ষিত" লেখা। যা শুধু ওয়েবসাইটের দাম-তালিকা থেকে নেওয়া, তা "তালিকা অনুযায়ী" লেখা। দাম বদলাতে পারে।

## ১. এখন যা আছে (কাজ করছে)
| Capability | অবস্থা |
|---|---|
| Chat, streaming উত্তর, Markdown, code block | আছে, কাজ করছে |
| History, rename, delete, search (ভিজিটরের নিজের ব্রাউজারে) | আছে |
| Memory (ভিজিটরের অনুমতিতে, দেখা/মোছা যায়) | আছে |
| Copy, Regenerate, Stop বোতাম | আছে |
| Voice call (Gemini Live, পুরুষ/নারী কণ্ঠ) | আছে (এটা "Abid World" থ্রেড দেখছে, আমি হাত দিচ্ছি না) |
| **ছবি বোঝা** (ছবি/স্ক্রিনশট/PDF upload করে প্রশ্ন) | **আছে।** ফ্রি Gemini দিয়েই চলে। শুধু পরীক্ষা আর ছোট উন্নতি লাগবে। |
| বাংলা / Banglish / ইংরেজি বোঝা | আছে |

## ২. যা নেই
| Capability | এখনকার অবস্থা |
|---|---|
| Web Search (ফোনের দাম, খবর, নতুন তথ্য) | নেই। AI এখন সৎভাবে বলে "আমি ইন্টারনেট দেখতে পারি না"। |
| Live Crypto দাম | নেই। AI এখন বলে "লাইভ দাম দেখতে পারি না"। |
| ছবি তৈরি (Text-to-Image) | নেই |
| ছবি Edit / Variation / Background বদল | নেই |
| Sources card, search চলছে দেখানো, ছবি তৈরির progress | নেই |
| নিজে বুঝে Tool বাছাই (Search / Crypto / Image / সাধারণ উত্তর) | নেই |

## ৩. আজ আসল API-তে যা পরীক্ষা করা হলো (আপনার ফ্রি Gemini key দিয়ে)
- সাধারণ chat: চলে (HTTP 200)।
- **Google Search grounding (Gemini-র নিজের web search): চলে না।** দুটো মডেলেই HTTP 429 "quota exceeded"। মানে ফ্রি key-তে এটা বন্ধ, billing চালু করতে হবে।
- **Gemini দিয়ে ছবি তৈরি: চলে না।** সব image মডেলে (gemini-2.5-flash-image, gemini-3.1-flash-image, gemini-3-pro-image, gemini-3.1-flash-lite-image) উত্তর এসেছে "limit: 0"। মানে ফ্রি key-তে ছবি তৈরি একদম শূন্য।
- Imagen 4 আপনার key-তে তালিকাতেই নেই।

তাই ফ্রি থাকতে হলে Search আর Image-এর জন্য **অন্য ফ্রি সার্ভিস** লাগবে। নিচে সেটাই প্রস্তাব।

## ৪. কোন API লাগবে, খরচ কত
### ক) Web Search
| বিকল্প | খরচ | কার্ড লাগে? | মন্তব্য |
|---|---|---|---|
| **Tavily (প্রস্তাবিত, ফ্রি)** | মাসে ১,০০০ search ফ্রি (তালিকা অনুযায়ী)। key ছাড়া "keyless" মোডও আছে, তবে সীমা কম। | না | ফলাফলে title, link, তারিখ আসে। তারপর ফ্রি Gemini সেগুলো মিলিয়ে বাংলায় উত্তর লেখে, সাথে source link। |
| Gemini Google Search (paid) | billing চালুর পর মাসে ৫,০০০ search ফ্রি, তারপর প্রতি ১,০০০-এ প্রায় $১৪ (তালিকা অনুযায়ী)। billing চালু হলে chat-ও paid হয়, তবে flash-lite খুব সস্তা (প্রতি ১০ লাখ token $০.২৫ ইনপুট / $১.৫০ আউটপুট)। | হ্যাঁ | মান ভালো। **আপনার অনুমতি ছাড়া চালু করব না।** |
| Exa | মাসে $১০ ফ্রি ক্রেডিট (তালিকা অনুযায়ী) | না | দরকার হলে backup। |

### খ) Live Crypto
| বিকল্প | খরচ | মন্তব্য |
|---|---|---|
| **CoinGecko (প্রস্তাবিত)** | ফ্রি। key ছাড়া মিনিটে প্রায় ৫টা call। ফ্রি "Demo" key নিলে মিনিটে ১০০টা। | দাম (USD + টাকা), ২৪ ঘণ্টার পরিবর্তন, market cap, volume, ৭ দিনের chart। আমরা ৬০ সেকেন্ড cache রাখব, তাই সীমা যথেষ্ট। পাশে "Data: CoinGecko" লেখা থাকতে হবে (ওদের শর্ত)। |

### গ) ছবি তৈরি ও Edit
| বিকল্প | খরচ | কার্ড লাগে? | মন্তব্য |
|---|---|---|---|
| **Cloudflare Workers AI, FLUX.1 schnell (প্রস্তাবিত, ফ্রি)** | প্রতিদিন ১০,০০০ "neuron" ফ্রি। একটা ১০২৪×১০২৪ ছবিতে প্রায় ৬০ neuron, মানে **দিনে প্রায় ১৫০টা ছবি ফ্রি** (আমার হিসাব)। সীমা শেষ হলে শুধু বন্ধ হয়, বিল আসে না। | না | মান ভালো, তবে Nano Banana-র মতো নিখুঁত নয়। ছবির ভেতরে বাংলা লেখা ঠিকমতো আসবে না। |
| Cloudflare FLUX.2 klein 4B (Edit, ফ্রি) | একটা edit-এ প্রায় ১৩০ neuron, দিনে প্রায় ৭০টা (আমার হিসাব) | না | আপনার upload করা ছবি বা আগের ছবি বদলানো। রেফারেন্স ছবি ৫১২px-এর ছোট হতে হয়। |
| Gemini "Nano Banana" (paid) | প্রতি ছবি প্রায় $০.০৩৯ (প্রায় ৪.৫ টাকা)। Nano Banana 2 প্রায় $০.০৬৭। Pro প্রায় $০.১৩৪। (তালিকা অনুযায়ী) | হ্যাঁ | সবচেয়ে ভালো মান আর edit। **আপনার অনুমতি ছাড়া চালু করব না।** দিনে ১০০ ছবি হলে মাসে প্রায় $১২০। |

লাইসেন্স: FLUX.1 schnell, Apache 2.0 লাইসেন্সে প্রকাশিত, তাই ব্যবসায়িক ব্যবহার চলে। FLUX.2 klein 4B-এর শর্ত Black Forest Labs-এর terms-এ, চালুর আগে আবার মিলিয়ে দেখব। Gemini-র তৈরি ছবিতে অদৃশ্য SynthID watermark থাকে।

### ঘ) ছবি বোঝা
ফ্রি Gemini দিয়েই চলছে। নতুন কিছু কিনতে হবে না।

## ৫. মোট খরচ (ফ্রি পথে)
**০ টাকা।** আপনাকে শুধু দুটো ফ্রি অ্যাকাউন্ট খুলে key দিতে হবে (কার্ড লাগবে না):
1. Tavily (tavily.com): API key (`tvly-` দিয়ে শুরু)।
2. Cloudflare (dash.cloudflare.com): Account ID আর "Workers AI" permission-সহ একটা API Token।
3. (ইচ্ছা হলে) CoinGecko Demo key। না দিলেও চলবে।

key-গুলো শুধু Admin > AI-তে বসবে, সার্ভারে থাকবে। ব্রাউজার বা zip-এ কখনো যাবে না।

## ৬. যেভাবে বানাচ্ছি (পুরোনো সিস্টেম ভাঙা হবে না)
- **নিজে Tool বাছাই:** প্রতিটা প্রশ্নে সার্ভার দেখে নেবে কোনটা লাগবে: দাম/খবর/আজ/latest হলে Search, coin-এর নাম হলে Crypto, "ছবি বানাও / image create / chobi banao" হলে Image, ছবি দিয়ে "এটা বদলাও" হলে Edit, বাকি সব সাধারণ উত্তর। অস্পষ্ট হলে ফ্রি Gemini ছোট করে সিদ্ধান্ত নেবে। অকারণে search হবে না।
- **Search:** "খুঁজছি…" দেখাবে, তারপর উত্তর, নিচে Source card (নাম, লিংক, তারিখ), আর কখন খোঁজা হলো তার সময়। কিছু না পেলে বানিয়ে বলবে না।
- **Crypto:** দাম, ২৪ ঘণ্টার পরিবর্তন, market cap, volume, ছোট chart, সময় ও মুদ্রা। API না পেলে পরিষ্কার বলবে। বিনিয়োগের পরামর্শ বা নিশ্চয়তা দেবে না।
- **Image:** বাংলা/Banglish প্রশ্ন ফ্রি Gemini দিয়ে ইংরেজি prompt-এ রূপান্তর, তারপর ছবি তৈরি। Progress দেখাবে, ছবি চ্যাটের ভেতরেই দেখাবে, Download বোতাম, আকার (বর্গ / লম্বা / চওড়া) বাছাই, "আরও নীল করো" বললে আগের ছবি বদলাবে, ব্যর্থ হলে সৎভাবে জানাবে আর Retry দেবে। ছবি ভিজিটরের ব্রাউজারে history-তে থাকবে।
- **সীমা:** প্রতি ভিজিটর দিনে কয়টা ছবি/search, আর পুরো সাইটে দিনে কয়টা, Admin থেকে বদলানো যাবে।
- Paid বিকল্প (Gemini search, Nano Banana) কোডে থাকবে কিন্তু বন্ধ। আপনি অনুমতি দিলে Admin থেকে একটা টিক দিয়ে চালু।

## ৭. যা এখান থেকে পরীক্ষা করা যাবে না
- আমার সার্ভার থেকে CoinGecko, Tavily আর Cloudflare-এ যাওয়া যায় না (network বন্ধ)। তাই এগুলো নকল সার্ভার দিয়ে পরীক্ষা হবে, আর আসল পরীক্ষা staging-এ key বসানোর পর। ১০টা টেস্টের ফল তখন দেব, মিথ্যা PASS লিখব না।

## সূত্র (দাম ও সীমা)
- Gemini grounding ও token দাম: https://fastero.com/blog/gemini-api-pricing , https://docswatch.stevetoth.ai/gemini/gemini-api-pricing/2026-10-29/
- Gemini ছবির দাম: https://www.aifreeapi.com/en/posts/gemini-image-generation-free-tier , https://intuitionlabs.ai/articles/ai-image-generation-pricing-google-openai
- Cloudflare Workers AI: https://developers.cloudflare.com/workers-ai/platform/pricing/ , https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/
- CoinGecko: https://docs.coingecko.com/docs/keyless-public-api , https://docs.coingecko.com/docs/common-errors-rate-limit
- Tavily: https://docs.tavily.com/documentation/api-credits , https://help.tavily.com/articles/8816424538-pricing , https://docs.tavily.com/documentation/keyless
- ফ্রি search API তুলনা: https://parallel.ai/articles/best-free-web-search-api
