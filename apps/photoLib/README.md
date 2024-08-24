
# Running with ts-node

To import photos:

```powershell
photoLib import --importDir \\floyd\photo\mobile-uploads --photoLibDir \\floyd\photo\ && hr && photoLib import --importDir \\floyd\photo\MobileBackup --photoLibDir \\floyd\photo
```


To fix a photo library:

```powershell
npx ts-node --esm --project .\apps\photoLib\tsconfig.json .\apps\photoLib\src\photoLib.ts fix --photoLibDir \\floyd\photo\
```
