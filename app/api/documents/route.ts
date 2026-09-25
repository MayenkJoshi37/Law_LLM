import { NextRequest } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { SessionDocument } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 5;
const acceptedExtensions = new Set(["pdf", "txt", "md"]);

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function titleFromFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function sectionFor(text: string) {
  const line = text
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.length > 3 && item.length < 160);
  return line && (/^\d+[.)]/.test(line) || /^[A-Z][A-Z\s]{5,}$/.test(line)) ? line : undefined;
}

async function textPages(file: File) {
  if (extensionOf(file.name) !== "pdf") return [{ text: await file.text(), page: undefined }];

  const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/pdf" });
  const loader = new PDFLoader(blob, { splitPages: true, parsedItemSeparator: "\n" });
  const pages = await loader.load();
  return pages.map((page, index) => ({
    text: page.pageContent,
    page: typeof page.metadata.loc?.pageNumber === "number" ? page.metadata.loc.pageNumber : index + 1,
  }));
}

async function chunkFile(file: File): Promise<SessionDocument[]> {
  const pages = await textPages(file);
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1_350,
    chunkOverlap: 180,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });
  const chunks: SessionDocument[] = [];
  const source = titleFromFilename(file.name) || file.name;

  for (const page of pages) {
    if (!page.text.trim()) continue;
    const split = await splitter.splitText(page.text.replace(/\u0000/g, " "));
    for (const [index, text] of split.entries()) {
      if (chunks.length >= 60) return chunks;
      chunks.push({
        id: `${crypto.randomUUID()}-${index}`,
        source,
        text,
        ...(page.page ? { page: page.page } : {}),
        ...(sectionFor(text) ? { section: sectionFor(text) } : {}),
      });
    }
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Use multipart form data to upload documents." }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File)
    .slice(0, MAX_FILES);

  if (!files.length) return Response.json({ error: "Choose at least one PDF, TXT, or Markdown file." }, { status: 400 });

  const rejected = files.find(
    (file) => file.size > MAX_FILE_BYTES || !acceptedExtensions.has(extensionOf(file.name)),
  );
  if (rejected) {
    return Response.json(
      { error: "Files must be PDF, TXT, or Markdown and no larger than 8 MB each." },
      { status: 400 },
    );
  }

  try {
    const documents = (await Promise.all(files.map(chunkFile))).flat();
    if (!documents.length) {
      return Response.json({ error: "No readable text was found in those files." }, { status: 422 });
    }
    return Response.json({ documents, files: files.map((file) => file.name) });
  } catch (error) {
    console.error("Document processing failed", error);
    return Response.json(
      { error: "That document could not be processed. Try a text-based PDF or a smaller file." },
      { status: 422 },
    );
  }
}
