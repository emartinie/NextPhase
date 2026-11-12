"use strict";

const curriculum = [
  {
    id: "bereshit", number: 1, name: "Bereshit", title: "Light in the beginning",
    summary: "Follow the thread from creation to the Word, and from darkness to light.",
    primary: "john", related: "genesis", investigation: "creation-echoes", discussion: "light",
    question: "Why does John begin where Genesis begins?",
    reflection: "Read both openings again. What changes when light describes life in John rather than the first day of creation?"
  },
  {
    id: "noach", number: 2, name: "Noach", title: "A sign after the flood",
    summary: "Trace the promise after the flood through Genesis and Isaiah.",
    primary: "rainbow", related: "peace", investigation: "promise", discussion: "peace-talk",
    question: "How does Isaiah carry Noah’s story forward?",
    reflection: "What stays the same when Isaiah uses the flood to speak about peace? What is different about whom the promise addresses?"
  },
  {
    id: "lech-lecha", number: 3, name: "Lech Lecha", title: "Go forth",
    summary: "Follow Abram’s call from leaving home to trusting a promise.",
    primary: "call", related: "faith", investigation: "blessing", discussion: "trust",
    question: "How does the promise move from one household to many?",
    reflection: "Read the promises to Abram and then Paul’s description of Abraham. Which words describe God’s action, and which describe Abraham’s response?"
  }
];

const passages = {
  john: {
    title: "John 1:1–5", book: "John", chapter: 1, start: 1, section: "Gospel",
    lines: [
      "In the beginning was the Word, and the Word was with God, and the Word was God.",
      "The same was in the beginning with God.",
      "All things were made by him; and without him was not any thing made that was made.",
      "In him was life; and the life was the light of men.",
      "And the light shineth in darkness; and the darkness comprehended it not."
    ],
    word: "λόγος", transliteration: "logos", meaning: "word, speech, or account",
    language: "Greek · John 1:1", languageNote: "John uses ho logos, “the Word,” as the subject of the opening line. Its meaning in this passage develops through the claims John makes about the Word.",
    reference: "genesis", practice: "sabbath"
  },
  genesis: {
    title: "Genesis 1:1–5", book: "Genesis", chapter: 1, start: 1, section: "Torah",
    lines: [
      "In the beginning God created the heaven and the earth.",
      "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.",
      "And God said, Let there be light: and there was light.",
      "And God saw the light, that it was good: and God divided the light from the darkness.",
      "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day."
    ],
    word: "בְּרֵאשִׁית", transliteration: "bereshit", meaning: "in the beginning",
    language: "Hebrew · Genesis 1:1", languageNote: "Bereshit is the opening word of Genesis and the traditional Hebrew name for this weekly portion.",
    reference: "john", practice: "sabbath"
  },
  rainbow: {
    title: "Genesis 9:8–13", book: "Genesis", chapter: 9, start: 8, section: "Torah",
    lines: [
      "And God spake unto Noah, and to his sons with him, saying,",
      "And I, behold, I establish my covenant with you, and with your seed after you;",
      "And with every living creature that is with you, of the fowl, of the cattle, and of every beast of the earth with you; from all that go out of the ark, to every beast of the earth.",
      "And I will establish my covenant with you; neither shall all flesh be cut off any more by the waters of a flood; neither shall there any more be a flood to destroy the earth.",
      "And God said, This is the token of the covenant which I make between me and you and every living creature that is with you, for perpetual generations:",
      "I do set my bow in the cloud, and it shall be for a token of a covenant between me and the earth."
    ],
    word: "בְּרִית", transliteration: "berit", meaning: "covenant",
    language: "Hebrew · Genesis 9:9", languageNote: "Notice the parties named in the covenant: Noah, his descendants, and every living creature.",
    reference: "peace", practice: "life"
  },
  peace: {
    title: "Isaiah 54:9–10", book: "Isaiah", chapter: 54, start: 9, section: "Prophets",
    lines: [
      "For this is as the waters of Noah unto me: for as I have sworn that the waters of Noah should no more go over the earth; so have I sworn that I would not be wroth with thee, nor rebuke thee.",
      "For the mountains shall depart, and the hills be removed; but my kindness shall not depart from thee, neither shall the covenant of my peace be removed, saith the LORD that hath mercy on thee."
    ],
    word: "שָׁלוֹם", transliteration: "shalom", meaning: "peace, welfare, or wholeness",
    language: "Hebrew · Isaiah 54:10", languageNote: "Isaiah joins the word for covenant to the word for peace. Look at the parallel promise about kindness in the same verse.",
    reference: "rainbow", practice: "life"
  },
  call: {
    title: "Genesis 12:1–4", book: "Genesis", chapter: 12, start: 1, section: "Torah",
    lines: [
      "Now the LORD had said unto Abram, Get thee out of thy country, and from thy kindred, and from thy father's house, unto a land that I will shew thee:",
      "And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:",
      "And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed.",
      "So Abram departed, as the LORD had spoken unto him; and Lot went with him: and Abram was seventy and five years old when he departed out of Haran."
    ],
    word: "לֶךְ־לְךָ", transliteration: "lech lecha", meaning: "go forth",
    language: "Hebrew · Genesis 12:1", languageNote: "The phrase is both the opening command to Abram and the traditional name of the weekly portion.",
    reference: "faith", practice: "neighbor"
  },
  faith: {
    title: "Romans 4:18–21", book: "Romans", chapter: 4, start: 18, section: "Letters",
    lines: [
      "Who against hope believed in hope, that he might become the father of many nations, according to that which was spoken, So shall thy seed be.",
      "And being not weak in faith, he considered not his own body now dead, when he was about an hundred years old, neither yet the deadness of Sara's womb:",
      "He staggered not at the promise of God through unbelief; but was strong in faith, giving glory to God;",
      "And being fully persuaded that, what he had promised, he was able also to perform."
    ],
    word: "πίστις", transliteration: "pistis", meaning: "faith or trust",
    language: "Greek · Romans 4:19", languageNote: "Paul’s account places Abraham’s trust in the ability of the one who makes the promise.",
    reference: "call", practice: "neighbor"
  }
};

const investigations = {
  "creation-echoes": {
    title: "Creation echoes in John", source: "Genesis 1 and John 1",
    observation: "Genesis and John open with “In the beginning.” Both name light and darkness. Genesis places light on the first day, while John connects light to the life found in the Word.",
    interpretation: "The shared vocabulary makes a creation echo plausible. The comparison raises a further question about what John is saying about the Word.",
    passage: "genesis", thread: "bereshit"
  },
  promise: {
    title: "The waters of Noah in Isaiah", source: "Genesis 9 and Isaiah 54",
    observation: "Isaiah explicitly names Noah and recalls the promise that flood waters would not again cover the earth.",
    interpretation: "Isaiah draws on the earlier oath to give force to a promise of mercy. Compare what each passage says about the recipients and scope of the promise.",
    passage: "peace", thread: "noach"
  },
  blessing: {
    title: "The reach of Abram’s blessing", source: "Genesis 12 and Romans 4",
    observation: "Genesis speaks of all families of the earth. Romans describes Abraham as the father of many nations.",
    interpretation: "Read how Paul’s emphasis on trust develops the earlier promise. Distinguish the explicit statements in each passage from conclusions about how they fit together.",
    passage: "faith", thread: "lech-lecha"
  }
};

const commandments = {
  sabbath: { title: "Remember the Sabbath", reference: "Exodus 20:8–11", verse: "Remember the sabbath day, to keep it holy.", note: "Exodus links the Sabbath command to God’s rest after creation. Compare its reason with the creation account." },
  life: { title: "Accountability for human life", reference: "Genesis 9:5–6", verse: "Whoso sheddeth man's blood, by man shall his blood be shed: for in the image of God made he man.", note: "The flood narrative places accountability for human life alongside the blessing to Noah’s family." },
  neighbor: { title: "Love your neighbor", reference: "Leviticus 19:18", verse: "Thou shalt love thy neighbour as thyself: I am the LORD.", note: "A separate commandment to consider alongside the question of how blessing reaches beyond one household." }
};

const communities = {
  circle: { name: "Weekly Reading Circle", description: "Questions from the weekly passages.", initials: "WR", color: "blue" },
  research: { name: "Scripture & Investigation", description: "Compare texts and weigh interpretations.", initials: "SI", color: "amber" },
  prayer: { name: "Prayer & Practice", description: "Reflections on living out the readings.", initials: "PP", color: "green" }
};

const posts = [
  { id: "light", community: "circle", author: "Mara H.", initials: "MH", time: "Today", title: "Light before the lights", text: "Genesis names light before it names the sun and moon. John links light with life. What did you notice reading those openings together?", passage: "john", thread: "bereshit",
    replies: [{ author: "Daniel R.", text: "I marked the verbs this time. God speaks in Genesis. In John, the light keeps shining." }] },
  { id: "peace-talk", community: "research", author: "Eli S.", initials: "ES", time: "Yesterday", title: "Why bring Noah into a promise of peace?", text: "Isaiah names the waters of Noah as part of a promise to a different audience. I’m comparing what each passage says God will do.", passage: "peace", thread: "noach",
    replies: [{ author: "Mara H.", text: "The pairing of kindness and covenant in verse 10 stood out to me." }] },
  { id: "trust", community: "prayer", author: "Nadia T.", initials: "NT", time: "Monday", title: "Abram’s first step", text: "Abram leaves before he knows the place. I’d like to hear what the promise adds to the way we read his departure.", passage: "call", thread: "lech-lecha", replies: [] },
  { id: "promise-words", community: "circle", author: "Daniel R.", initials: "DR", time: "Monday", title: "Marking the words ‘I will’", text: "I underlined who is speaking in Genesis 12. It made the sequence of the promises easier to see.", passage: "call", thread: "lech-lecha", replies: [] }
];
