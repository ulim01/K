// mahogo-gallery-worker.js
// Cloudflare Worker + Durable Object: 간단한 디시 스타일 게시판

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const id = env.GALLERY.idFromName('main');
    const stub = env.GALLERY.get(id);
    return stub.fetch(req);
  },
};

export class GalleryDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.data = { posts: [] };
  }

  async fetch(req) {
    // Durable Object 내부 상태 복원
    const stored = await this.state.storage.get('data');
    if (stored) this.data = stored;

    const url = new URL(req.url);
    const path = url.pathname;

    // 글 목록 가져오기
    if (req.method === 'GET' && path === '/') {
      return new Response(JSON.stringify(this.data.posts), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 새 글 작성
    if (req.method === 'POST' && path === '/post') {
      const body = await req.json();
      const post = {
        id: Date.now(),
        title: body.title,
        author: body.author,
        content: body.content,
        likes: 0,
        dislikes: 0,
        comments: [],
      };
      this.data.posts.unshift(post);
      await this.state.storage.put('data', this.data);
      return new Response(JSON.stringify(post), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 댓글 작성
    if (req.method === 'POST' && path.startsWith('/comment/')) {
      const pid = parseInt(path.split('/').pop());
      const body = await req.json();
      const post = this.data.posts.find((p) => p.id === pid);
      if (!post) return new Response('Not found', { status: 404 });
      post.comments.push({ author: body.author, text: body.text });
      await this.state.storage.put('data', this.data);
      return new Response(JSON.stringify(post.comments), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 추천 / 비추천
    if (req.method === 'POST' && path.startsWith('/vote/')) {
      const pid = parseInt(path.split('/').pop());
      const body = await req.json();
      const post = this.data.posts.find((p) => p.id === pid);
      if (!post) return new Response('Not found', { status: 404 });
      if (body.type === 'like') post.likes++;
      else if (body.type === 'dislike') post.likes--;
      await this.state.storage.put('data', this.data);
      return new Response(JSON.stringify({ likes: post.likes }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
