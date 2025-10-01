import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">404 - 页面未找到</h1>
      <p className="text-gray-600 mb-8">抱歉，您请求的页面不存在或已被移除</p>
      <Link href="/" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        返回首页
      </Link>
    </div>
  );
}