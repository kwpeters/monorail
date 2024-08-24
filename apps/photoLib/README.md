

# Example command lines

To import photos:

```text
photoLib import --importDir \\floyd\photo\mobile-uploads --photoLibDir \\floyd\photo\
photoLib import --importDir \\floyd\photo\MobileBackup --photoLibDir \\floyd\photo
```

To fix a photo library:

```text
photoLib fix --photoLibDir \\floyd\photo\
```





# Running with ts-node

To run any of the above examples with ts-node, simply replace the `photoLib` executable in the above examples with:

```text
npx ts-node --esm --project .\apps\photoLib\tsconfig.json .\apps\photoLib\src\photoLib.ts
```
