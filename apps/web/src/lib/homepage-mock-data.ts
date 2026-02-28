import type {
  FeedFilter,
  HotNetworkItem,
  NavItem,
  PopularTag,
  QuestionSummary,
} from "@/lib/homepage-types";

const navItems: NavItem[] = [
  { id: "home", label: "Home", href: "#", active: true },
  { id: "collections", label: "Collections", href: "#" },
  { id: "jobs", label: "Find Jobs", href: "#" },
  { id: "tags", label: "Tags", href: "#" },
  { id: "communities", label: "Communities", href: "#" },
  { id: "ask", label: "Ask a Question", href: "#" },
  { id: "recommended", label: "Recommended Qs", href: "#" },
];

const filters: FeedFilter[] = [
  { key: "newest", label: "Newest" },
  { key: "recommended", label: "Recommended Questions" },
  { key: "frequent", label: "Frequent" },
  { key: "unanswered", label: "Unanswered" },
];

const baseQuestions: QuestionSummary[] = [
  {
    postId: "q-1001",
    title:
      "The Lightning Component cLWC_PizzaTracker generated invalid output for field status. Error: How to solve this",
    authorName: "Santresh",
    authorHandle: "@santresh",
    avatarText: "ST",
    createdAtLabel: "asked 2 mins ago",
    votes: 1200,
    answers: 100,
    views: "4.8k",
    tags: [
      { id: "tag-1", displayName: "javascript" },
      { id: "tag-2", displayName: "reactjs" },
      { id: "tag-3", displayName: "next.js" },
    ],
  },
  {
    postId: "q-1002",
    title:
      "An HTML table where specific cells come from values in a Google Sheet identified by their neighboring cell",
    authorName: "Santresh",
    authorHandle: "@santresh",
    avatarText: "ST",
    createdAtLabel: "asked 2 mins ago",
    votes: 1200,
    answers: 100,
    views: "4.8k",
    tags: [
      { id: "tag-4", displayName: "google-sheets" },
      { id: "tag-5", displayName: "html-table" },
      { id: "tag-6", displayName: "api" },
    ],
  },
  {
    postId: "q-1003",
    title:
      "JavaScript validation for a form stops the form data from being submitted to mysql database",
    authorName: "Santresh",
    authorHandle: "@santresh",
    avatarText: "ST",
    createdAtLabel: "asked 2 mins ago",
    votes: 1200,
    answers: 100,
    views: "4.8k",
    tags: [
      { id: "tag-7", displayName: "mysql" },
      { id: "tag-8", displayName: "forms" },
      { id: "tag-9", displayName: "validation" },
    ],
  },
];

const recommendedQuestions: QuestionSummary[] = [
  {
    ...baseQuestions[0],
    postId: "q-2001",
    votes: 4300,
    views: "12.1k",
    createdAtLabel: "asked 1 hour ago",
  },
  {
    ...baseQuestions[1],
    postId: "q-2002",
    votes: 3100,
    views: "8.2k",
    createdAtLabel: "asked 3 hours ago",
  },
  {
    ...baseQuestions[2],
    postId: "q-2003",
    votes: 2900,
    views: "7.6k",
    createdAtLabel: "asked 5 hours ago",
  },
];

const frequentQuestions: QuestionSummary[] = [
  {
    ...baseQuestions[1],
    postId: "q-3001",
    views: "20.2k",
    createdAtLabel: "asked 2 days ago",
  },
  {
    ...baseQuestions[0],
    postId: "q-3002",
    views: "18.7k",
    createdAtLabel: "asked 1 day ago",
  },
  {
    ...baseQuestions[2],
    postId: "q-3003",
    views: "15.3k",
    createdAtLabel: "asked 3 days ago",
  },
];

const unansweredQuestions: QuestionSummary[] = [
  {
    ...baseQuestions[2],
    postId: "q-4001",
    answers: 0,
    votes: 14,
    views: "530",
    createdAtLabel: "asked 4 mins ago",
  },
  {
    ...baseQuestions[0],
    postId: "q-4002",
    answers: 0,
    votes: 8,
    views: "214",
    createdAtLabel: "asked 10 mins ago",
  },
  {
    ...baseQuestions[1],
    postId: "q-4003",
    answers: 0,
    votes: 3,
    views: "91",
    createdAtLabel: "asked 17 mins ago",
  },
];

const hotNetwork: HotNetworkItem[] = [
  { id: "hot-1", title: "Would it be appropriate to point out an error in another paper during a referee report?" },
  { id: "hot-2", title: "How can an air-conditioning machine chill?" },
  { id: "hot-3", title: "Interrogated every time crossing UK border security" },
  { id: "hot-4", title: "Low light addition generator" },
  { id: "hot-5", title: "What is an example of a numbers fruit do not make up a vector?" },
];

const popularTags: PopularTag[] = [
  { id: "pt-1", name: "javascript", countLabel: "20152+" },
  { id: "pt-2", name: "next.js", countLabel: "18304+" },
  { id: "pt-3", name: "react", countLabel: "16892+" },
  { id: "pt-4", name: "typescript", countLabel: "15491+" },
  { id: "pt-5", name: "node.js", countLabel: "14940+" },
];

export const homepageData = {
  navItems,
  filters,
  hotNetwork,
  popularTags,
  questionsByFilter: {
    newest: baseQuestions,
    recommended: recommendedQuestions,
    frequent: frequentQuestions,
    unanswered: unansweredQuestions,
  },
};
