const EN_ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const EN_TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const BN_0_TO_99 = [
  "শূন্য",
  "এক",
  "দুই",
  "তিন",
  "চার",
  "পাঁচ",
  "ছয়",
  "সাত",
  "আট",
  "নয়",
  "দশ",
  "এগারো",
  "বারো",
  "তেরো",
  "চৌদ্দ",
  "পনেরো",
  "ষোল",
  "সতেরো",
  "আঠারো",
  "উনিশ",
  "বিশ",
  "একুশ",
  "বাইশ",
  "তেইশ",
  "চব্বিশ",
  "পঁচিশ",
  "ছাব্বিশ",
  "সাতাশ",
  "আটাশ",
  "ঊনত্রিশ",
  "ত্রিশ",
  "একত্রিশ",
  "বত্রিশ",
  "তেত্রিশ",
  "চৌত্রিশ",
  "পঁয়ত্রিশ",
  "ছত্রিশ",
  "সাঁইত্রিশ",
  "আটত্রিশ",
  "ঊনচল্লিশ",
  "চল্লিশ",
  "একচল্লিশ",
  "বিয়াল্লিশ",
  "তেতাল্লিশ",
  "চুয়াল্লিশ",
  "পঁয়তাল্লিশ",
  "ছেচল্লিশ",
  "সাতচল্লিশ",
  "আটচল্লিশ",
  "ঊনপঞ্চাশ",
  "পঞ্চাশ",
  "একান্ন",
  "বাহান্ন",
  "তিপ্পান্ন",
  "চুয়ান্ন",
  "পঞ্চান্ন",
  "ছাপ্পান্ন",
  "সাতান্ন",
  "আটান্ন",
  "ঊনষাট",
  "ষাট",
  "একষট্টি",
  "বাষট্টি",
  "তেষট্টি",
  "চৌষট্টি",
  "পঁয়ষট্টি",
  "ছেষট্টি",
  "সাতষট্টি",
  "আটষট্টি",
  "ঊনসত্তর",
  "সত্তর",
  "একাত্তর",
  "বাহাত্তর",
  "তিয়াত্তর",
  "চুয়াত্তর",
  "পঁচাত্তর",
  "ছিয়াত্তর",
  "সাতাত্তর",
  "আটাত্তর",
  "ঊনআশি",
  "আশি",
  "একাশি",
  "বিরাশি",
  "তিরাশি",
  "চুরাশি",
  "পঁচাশি",
  "ছিয়াশি",
  "সাতাশি",
  "আটাশি",
  "ঊননব্বই",
  "নব্বই",
  "একানব্বই",
  "বিরানব্বই",
  "তিরানব্বই",
  "চুরানব্বই",
  "পঁচানব্বই",
  "ছিয়ানব্বই",
  "সাতানব্বই",
  "আটানব্বই",
  "নিরানব্বই",
];

function toPaisa(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round((n + Number.EPSILON) * 100);
}

function englishUnderThousand(n) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds) {
    parts.push(`${EN_ONES[hundreds]} Hundred`);
  }
  if (remainder) {
    if (remainder < 20) {
      parts.push(EN_ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(ones ? `${EN_TENS[tens]} ${EN_ONES[ones]}` : EN_TENS[tens]);
    }
  }

  return parts.join(" ");
}

function integerToEnglishWords(n) {
  if (n === 0) return EN_ONES[0];

  const parts = [];
  const scales = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ];
  let remaining = n;

  scales.forEach(([value, label]) => {
    const count = Math.floor(remaining / value);
    if (count) {
      parts.push(`${integerToEnglishWords(count)} ${label}`);
      remaining %= value;
    }
  });

  if (remaining) {
    parts.push(englishUnderThousand(remaining));
  }

  return parts.join(" ");
}

function banglaUnderThousand(n) {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const parts = [];

  if (hundreds) {
    parts.push(`${BN_0_TO_99[hundreds]}শত`);
  }
  if (remainder) {
    parts.push(BN_0_TO_99[remainder]);
  }

  return parts.join(" ");
}

function integerToBanglaWords(n) {
  if (n === 0) return BN_0_TO_99[0];

  const parts = [];
  const scales = [
    [10000000, "কোটি"],
    [100000, "লক্ষ"],
    [1000, "হাজার"],
  ];
  let remaining = n;

  scales.forEach(([value, label]) => {
    const count = Math.floor(remaining / value);
    if (count) {
      parts.push(`${integerToBanglaWords(count)} ${label}`);
      remaining %= value;
    }
  });

  if (remaining) {
    parts.push(banglaUnderThousand(remaining));
  }

  return parts.join(" ");
}

export function formatAmountInWords(amount) {
  const paisa = toPaisa(amount);
  const taka = Math.floor(paisa / 100);
  const poisha = paisa % 100;

  const englishPoisha = poisha
    ? ` and ${integerToEnglishWords(poisha)} Poisha`
    : "";
  const banglaPoisha = poisha
    ? ` ${integerToBanglaWords(poisha)} পয়সা`
    : "";

  return {
    english: `${integerToEnglishWords(taka)} Taka${englishPoisha} Only`,
    bangla: `${integerToBanglaWords(taka)} টাকা${banglaPoisha} মাত্র`,
  };
}
