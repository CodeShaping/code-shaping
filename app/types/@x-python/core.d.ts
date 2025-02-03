declare module '@x-python/core' {
    export function init(): Promise<void>;
    export function install(packages: string[]): Promise<void>;
    export function format(options: { code: string }): Promise<{ result: string }>;
    export function exec(options: { code: string }): Promise<{
        error: string | null;
        stdout: string | null;
        stderr: string | null;
    }>;
} 