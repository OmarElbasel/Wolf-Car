/** next-intl keys can't contain "."; dotted ids (actions, permissions) are stored with "_". */
export const msgKey = (id: string) => id.replaceAll(".", "_");
