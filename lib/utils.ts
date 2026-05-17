/**
 * 本文件提供通用工具函数，例如 Tailwind className 合并。
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  // clsx 负责条件拼接，twMerge 负责去掉互相冲突的 Tailwind class。
  return twMerge(clsx(inputs));
}
