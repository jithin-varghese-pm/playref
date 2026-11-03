/**
 * Imposter word packs. Indian packs first: no global Imposter app has these.
 * `category` is what everyone sees, including the imposter (rule I3).
 * Words are plain names of foods, places, things and film titles. No film text or art is used.
 */
export interface WordPack {
  id: string;
  name: string;
  category: string;
  words: string[];
}

export const WORD_PACKS: WordPack[] = [
  {
    id: 'kerala-food',
    name: 'Kerala food',
    category: 'Food',
    words: [
      'Puttu', 'Appam', 'Idiyappam', 'Porotta', 'Avial', 'Sambar', 'Payasam', 'Sadya', 'Kappa', 'Pazham pori',
      'Unniyappam', 'Ada pradhaman', 'Karimeen fry', 'Erissery', 'Thoran', 'Olan', 'Kozhukatta', 'Neyyappam',
      'Banana chips', 'Kozhikode halwa', 'Achappam', 'Fish curry', 'Thalassery biryani', 'Pathiri', 'Parippu vada',
      'Uzhunnu vada', 'Sulaimani', 'Kulukki sarbath', 'Mango pickle', 'Chakka',
    ],
  },
  {
    id: 'malayalam-films',
    name: 'Malayalam films',
    category: 'Malayalam film',
    words: [
      'Drishyam', 'Premam', 'Bangalore Days', 'Kumbalangi Nights', 'Manichitrathazhu', 'Minnal Murali', 'Lucifer',
      'Manjummel Boys', 'Aavesham', 'Romancham', 'Thallumaala', 'Kireedam', 'Spadikam', 'Nadodikkattu',
      'In Harihar Nagar', 'Ustad Hotel', 'Charlie', 'Maheshinte Prathikaaram', 'Ohm Shanthi Oshaana', 'Pulimurugan',
      'Premalu', 'Bramayugam', 'Kilukkam', 'Godfather', 'Thanmathra', 'Chithram', 'Classmates', 'Thondimuthalum Driksakshiyum',
      'Angamaly Diaries', 'Jan.E.Man',
    ],
  },
  {
    id: 'cricket',
    name: 'Cricket',
    category: 'Cricket',
    words: [
      'Sixer', 'Wicket', 'Yorker', 'Bouncer', 'LBW', 'Umpire', 'Duck', 'Century', 'Googly', 'Stumps', 'Run out',
      'Powerplay', 'Free hit', 'No ball', 'Wide', 'Hat-trick', 'Slip', 'Captain', 'Toss', 'Super over', 'Helmet',
      'Pitch', 'Boundary', 'Maiden over', 'Spinner', 'IPL', 'Test match', 'Third umpire', 'Scoreboard', 'Fielder',
    ],
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru places',
    category: 'Place in Bengaluru',
    words: [
      'MG Road', 'Cubbon Park', 'Lalbagh', 'Koramangala', 'Indiranagar', 'Whitefield', 'Silk Board', 'Majestic',
      'Nandi Hills', 'Brigade Road', 'Electronic City', 'Vidhana Soudha', 'Bannerghatta', 'Malleshwaram', 'Jayanagar',
      'HSR Layout', 'Commercial Street', 'Church Street', 'Bangalore Palace', 'Ulsoor Lake', 'Hebbal flyover',
      'Chinnaswamy Stadium', 'Namma Metro', 'Marathahalli', 'BTM Layout', 'Yeshwanthpur', 'KR Market', 'Airport',
      'Basavanagudi', 'Sankey Tank',
    ],
  },
  {
    id: 'bollywood',
    name: 'Bollywood',
    category: 'Bollywood film',
    words: [
      'Sholay', 'DDLJ', '3 Idiots', 'Lagaan', 'Dangal', 'PK', 'Gully Boy', 'Zindagi Na Milegi Dobara', 'Andhadhun',
      'Queen', 'Barfi', 'Chak De India', 'Kabhi Khushi Kabhie Gham', 'Jab We Met', 'Hera Pheri', 'Munna Bhai MBBS',
      'Taare Zameen Par', 'Kahaani', 'Dil Chahta Hai', 'Bajrangi Bhaijaan', 'Om Shanti Om', 'Pathaan', 'Jawan',
      'Stree', 'Swades', 'Rang De Basanti', 'Yeh Jawaani Hai Deewani', 'Golmaal', 'Kuch Kuch Hota Hai', 'Dhoom',
    ],
  },
  {
    id: 'everyday',
    name: 'Everyday things',
    category: 'Everyday thing',
    words: [
      'Umbrella', 'Toothbrush', 'Pressure cooker', 'Mosquito net', 'Auto rickshaw', 'Ceiling fan', 'Phone charger',
      'Bucket', 'Mirror', 'Pillow', 'Tiffin box', 'Water bottle', 'Sunglasses', 'Bicycle', 'Backpack', 'Candle',
      'TV remote', 'Newspaper', 'Wallet', 'Clock', 'Slippers', 'Scissors', 'Tea cup', 'Keys', 'Calculator', 'Torch',
      'Raincoat', 'Comb', 'Matchbox', 'Steel tumbler',
    ],
  },
];
