import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Товар не найден" }, { status: 404 });
  }
  return NextResponse.json(product);
}
