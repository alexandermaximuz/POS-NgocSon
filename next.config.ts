import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /*
     * File Excel import được gửi lên qua Server Action. Mặc định của Next là 1MB,
     * đủ cho vài trăm dòng nhưng không đủ cho file bảng giá vài nghìn dòng có
     * định dạng. `import-actions.ts` tự chặn ở 4MB kèm thông báo tiếng Việt, nên
     * giới hạn ở đây chỉ cần rộng hơn con số đó một chút.
     */
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
