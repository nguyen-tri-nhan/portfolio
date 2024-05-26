function base64ToString(base64: string): string {
    const decodedString = atob(base64);
    return decodedString;
}
