// Normalized base path: strips trailing slash so ${base}/foo always produces /career-site/foo
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
