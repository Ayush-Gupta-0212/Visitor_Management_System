/**
 * Reviewer convenience only: the sign-in page lists these so every account can be
 * tried in one click. Sign-in itself checks salted hashes (ACCOUNTS in mockData.ts);
 * a real deployment would authenticate through the company's identity provider and
 * never ship passwords to the browser.
 */
export const DEMO_PASSWORDS: Readonly<Record<string, string>> = {
  'suresh.pawar@corp.example': 'suresh@123',
  'lalita.mehta@corp.example': 'lalita@123',
  'rohan.deshpande@corp.example': 'rohan@123',
  'ananya.iyer@corp.example': 'ananya@123',
  'vikram.rathore@corp.example': 'vikram@123',
  'meera.krishnan@corp.example': 'meera@123',
  'farhan.qureshi@corp.example': 'farhan@123',
  'kavita.joshi@corp.example': 'kavita@123',
}
