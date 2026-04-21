import type { CurriculumPack } from "@/types";

export const curriculumPacks: CurriculumPack[] = [
  {
    id: "keirinkan.science.grade3",
    publisher: "keirinkan",
    publisher_label: "啓林館",
    subject: "science",
    subject_label: "理科",
    grade: 3,
    year: 2024,
  },
  {
    id: "keirinkan.science.grade4",
    publisher: "keirinkan",
    publisher_label: "啓林館",
    subject: "science",
    subject_label: "理科",
    grade: 4,
    year: 2024,
  },
];

export function getCurriculumPack(id: string): CurriculumPack | undefined {
  return curriculumPacks.find((pack) => pack.id === id);
}
