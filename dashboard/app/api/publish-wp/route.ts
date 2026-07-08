import { NextRequest, NextResponse } from "next/server";
import { admin } from "../../../lib/admin";

const WP_URL = "https://portal497.com.br/wp-json/wp/v2";
const WP_USER = "joao";
const WP_APP_PASSWORD = "6Zq6 rNlK 9fxc QDzl a7Q8 X4nf";
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");

// POST: publish article to WordPress
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      articleId,
      title,
      content,
      excerpt,
      categories,
      editoriaisGeral,
      estadocidade,
      tags,
      author,
      status,
      featuredMediaUrl,
    } = body;

    // Step 1: Upload featured image if provided
    let featuredMediaId = 0;
    if (featuredMediaUrl) {
      try {
        // Download image
        const imgRes = await fetch(featuredMediaUrl);
        const imgBuffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        const ext = contentType.includes("png") ? "png" : "jpg";
        const filename = `pulso-rs-${Date.now()}.${ext}`;

        // Upload to WP
        const uploadRes = await fetch(`${WP_URL}/media`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${AUTH}`,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Type": contentType,
          },
          body: imgBuffer,
        });

        if (uploadRes.ok) {
          const media = await uploadRes.json();
          featuredMediaId = media.id;
        }
      } catch {
        // Image upload failed, continue without
      }
    }

    // Step 2: Resolve tag names to IDs (create if needed)
    const tagIds: number[] = [];
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // Search existing tag
        const searchRes = await fetch(
          `${WP_URL}/tags?search=${encodeURIComponent(tagName)}&_fields=id,name`,
          { headers: { Authorization: `Basic ${AUTH}` } }
        );
        const existing = await searchRes.json();
        const match = existing.find(
          (t: any) => t.name.toLowerCase() === tagName.toLowerCase()
        );

        if (match) {
          tagIds.push(match.id);
        } else {
          // Create new tag
          const createRes = await fetch(`${WP_URL}/tags`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${AUTH}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: tagName }),
          });
          if (createRes.ok) {
            const newTag = await createRes.json();
            tagIds.push(newTag.id);
          }
        }
      }
    }

    // Step 3: Create the post
    const postData: any = {
      title,
      content,
      excerpt: excerpt || "",
      status: status || "draft",
      author: author || 8,
      categories: categories || [],
      tags: tagIds,
      "editoriais-geral": editoriaisGeral || [],
      estadocidade: estadocidade || [],
    };

    if (featuredMediaId) {
      postData.featured_media = featuredMediaId;
    }

    const postRes = await fetch(`${WP_URL}/posts`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      return NextResponse.json(
        { error: `WordPress error: ${err}` },
        { status: postRes.status }
      );
    }

    const post = await postRes.json();

    // Publicou no portal 497 → marca a matéria como "usada" (badge no dashboard).
    // Tolerante: se a coluna used_in_portal ainda não existir, não falha a publicação.
    if (articleId) {
      try { await admin.from("articles").update({ used_in_portal: true }).eq("id", articleId); }
      catch { /* coluna ausente ou erro de rede — publicação já foi, ignora */ }
    }

    // For drafts, WP returns /?p=ID which isn't useful — give wp-admin edit link instead
    const editLink = `https://portal497.com.br/wp-admin/post.php?post=${post.id}&action=edit`;
    const publicLink = post.status === "publish" ? post.link : editLink;
    return NextResponse.json({
      success: true,
      postId: post.id,
      link: publicLink,
      editLink,
      status: post.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}

// GET: fetch WordPress taxonomies (categories, editoriais, cidades, authors)
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");

  try {
    let url = "";
    switch (type) {
      case "categories":
        url = `${WP_URL}/categories?per_page=50&_fields=id,name`;
        break;
      case "editoriais-geral":
        url = `${WP_URL}/editoriais-geral?per_page=50&_fields=id,name`;
        break;
      case "cidades":
        const search = req.nextUrl.searchParams.get("search") || "";
        url = `${WP_URL}/estadocidade?per_page=20&search=${encodeURIComponent(search)}&_fields=id,name`;
        break;
      case "authors":
        url = `${WP_URL}/users?_fields=id,name`;
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${AUTH}` },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
