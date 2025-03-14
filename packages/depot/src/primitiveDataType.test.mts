import { NonNegativeInt, Int8, UInt8, Int16, UInt16, Int32, UInt32, Int64, UInt64, Float32, Float64 } from "./primitiveDataType.mjs";


describe("NonNegativeInt", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(NonNegativeInt.dataTypeMin).toEqual(0);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(NonNegativeInt.dataTypeMax).toEqual(Number.MAX_SAFE_INTEGER);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(NonNegativeInt.fromString("").failed).toBeTrue();
                expect(NonNegativeInt.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(NonNegativeInt.fromString("-1").failed).toBeTrue();
                // Over range
                expect(NonNegativeInt.fromString("9007199254740992").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(NonNegativeInt.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = NonNegativeInt.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(NonNegativeInt.create(-1).failed).toBeTrue();
                // Over range
                expect(NonNegativeInt.create(9007199254740992).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(NonNegativeInt.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = NonNegativeInt.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("numBits", () => {

            it("returns 64", () => {
                expect(NonNegativeInt.numBits).toEqual(64);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = NonNegativeInt.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});


describe("Int8", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Int8.dataTypeMin).toEqual(-128);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Int8.dataTypeMax).toEqual(127);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Int8.fromString("").failed).toBeTrue();
                expect(Int8.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(Int8.fromString("-129").failed).toBeTrue();
                // Over range
                expect(Int8.fromString("128").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(Int8.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = Int8.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(Int8.create(-129).failed).toBeTrue();
                // Over range
                expect(Int8.create(128).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(Int8.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = Int8.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("numBits", () => {

            it("returns 8", () => {
                expect(Int8.numBits).toEqual(8);
            });

        });


        describe("maxBitIndex", () => {

            it("returns 7", () => {
                expect(Int8.maxBitIndex).toEqual(7);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Int8.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });


        describe("getBit", () => {

            it("returns the correct bit value", () => {
                const inst = Int8.create(5).throwIfFailed(); // 5 is 00000101 in binary
                expect(inst.getBit(0).value).toBeTrue();
                expect(inst.getBit(1).value).toBeFalse();
                expect(inst.getBit(2).value).toBeTrue();
            });

        });


        describe("setBit", () => {

            it("sets the correct bit value", () => {
                const inst = Int8.create(5).throwIfFailed(); // 5 is 00000101 in binary
                const res = inst.setBit(1, true).throwIfFailed(); // should set the second bit to 1, resulting in 7 (00000111)
                expect(res.value).toEqual(7);
            });

        });

    });

});


describe("UInt8", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(UInt8.dataTypeMin).toEqual(0);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(UInt8.dataTypeMax).toEqual(255);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(UInt8.fromString("").failed).toBeTrue();
                expect(UInt8.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(UInt8.fromString("-1").failed).toBeTrue();
                // Over range
                expect(UInt8.fromString("256").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(UInt8.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = UInt8.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(UInt8.create(-1).failed).toBeTrue();
                // Over range
                expect(UInt8.create(256).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(UInt8.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = UInt8.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("numBits", () => {

            it("returns 8", () => {
                expect(UInt8.numBits).toEqual(8);
            });

        });


        describe("maxBitIndex", () => {

            it("returns 7", () => {
                expect(UInt8.maxBitIndex).toEqual(7);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = UInt8.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });


        describe("getBit", () => {

            it("returns the correct bit value", () => {
                const inst = UInt8.create(5).throwIfFailed(); // 5 is 00000101 in binary
                expect(inst.getBit(0).value).toBeTrue();
                expect(inst.getBit(1).value).toBeFalse();
                expect(inst.getBit(2).value).toBeTrue();
            });


            it("returns the correct bit value when the highest order bit is set", () => {
                const inst = UInt8.create(0b1000_0000).throwIfFailed();
                expect(inst.getBit(7).value).toBeTrue();
            });

        });


        describe("setBit", () => {

            it("sets the correct bit value", () => {
                const inst = UInt8.create(5).throwIfFailed(); // 5 is 00000101 in binary
                const res = inst.setBit(1, true).throwIfFailed(); // should set the second bit to 1, resulting in 7 (00000111)
                expect(res.value).toEqual(7);
            });

        });

    });

});


describe("Int16", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Int16.dataTypeMin).toEqual(-32768);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Int16.dataTypeMax).toEqual(32767);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Int16.fromString("").failed).toBeTrue();
                expect(Int16.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(Int16.fromString("-32769").failed).toBeTrue();
                // Over range
                expect(Int16.fromString("32768").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(Int16.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = Int16.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(Int16.create(-32769).failed).toBeTrue();
                // Over range
                expect(Int16.create(32768).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(Int16.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = Int16.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("numBits", () => {

            it("returns 16", () => {
                expect(Int16.numBits).toEqual(16);
            });

        });


        describe("maxBitIndex", () => {

            it("returns 15", () => {
                expect(Int16.maxBitIndex).toEqual(15);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Int16.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });


        describe("getBit", () => {

            it("returns the correct bit value", () => {
                const inst = Int16.create(5).throwIfFailed(); // 5 is 0000000000000101 in binary
                expect(inst.getBit(0).value).toBeTrue();
                expect(inst.getBit(1).value).toBeFalse();
                expect(inst.getBit(2).value).toBeTrue();
            });

        });


        describe("setBit", () => {

            it("sets the correct bit value", () => {
                const inst = Int16.create(5).throwIfFailed(); // 5 is 0000000000000101 in binary
                const res = inst.setBit(1, true).throwIfFailed(); // should set the second bit to 1, resulting in 7 (0000000000000111)
                expect(res.value).toEqual(7);
            });

        });

    });

});


describe("UInt16", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(UInt16.dataTypeMin).toEqual(0);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(UInt16.dataTypeMax).toEqual(65535);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(UInt16.fromString("").failed).toBeTrue();
                expect(UInt16.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(UInt16.fromString("-1").failed).toBeTrue();
                // Over range
                expect(UInt16.fromString("65536").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(UInt16.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = UInt16.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(UInt16.create(-1).failed).toBeTrue();
                // Over range
                expect(UInt16.create(65536).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(UInt16.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = UInt16.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("numBits", () => {

            it("returns 16", () => {
                expect(UInt16.numBits).toEqual(16);
            });

        });


        describe("maxBitIndex", () => {

            it("returns 15", () => {
                expect(UInt16.maxBitIndex).toEqual(15);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = UInt16.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });


        describe("getBit", () => {

            it("returns the correct bit value", () => {
                const inst = UInt16.create(5).throwIfFailed(); // 5 is 0000000000000101 in binary
                expect(inst.getBit(0).value).toBeTrue();
                expect(inst.getBit(1).value).toBeFalse();
                expect(inst.getBit(2).value).toBeTrue();
            });


            it("returns the correct bit value when the highest order bit is set", () => {
                const inst = UInt16.create(0b1000_0000_0000_0000).throwIfFailed();
                expect(inst.getBit(15).value).toBeTrue();
            });

        });


        describe("setBit", () => {

            it("sets the correct bit value", () => {
                const inst = UInt16.create(5).throwIfFailed(); // 5 is 0000000000000101 in binary
                const res = inst.setBit(1, true).throwIfFailed(); // should set the second bit to 1, resulting in 7 (0000000000000111)
                expect(res.value).toEqual(7);
            });

        });

    });

});


describe("Int32", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Int32.dataTypeMin).toEqual(-2147483648);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Int32.dataTypeMax).toEqual(2147483647);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Int32.fromString("").failed).toBeTrue();
                expect(Int32.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(Int32.fromString("-2147483649").failed).toBeTrue();
                // Over range
                expect(Int32.fromString("2147483648").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(Int32.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = Int32.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(Int32.create(-2147483649).failed).toBeTrue();
                // Over range
                expect(Int32.create(2147483648).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(Int32.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = Int32.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("numBits", () => {

            it("returns 32", () => {
                expect(Int32.numBits).toEqual(32);
            });

        });


        describe("maxBitIndex", () => {

            it("returns 31", () => {
                expect(Int32.maxBitIndex).toEqual(31);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Int32.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });


        describe("getBit", () => {

            it("returns the correct bit value", () => {
                const inst = Int32.create(5).throwIfFailed(); // 5 is 00000000000000000000000000000101 in binary
                expect(inst.getBit(0).value).toBeTrue();
                expect(inst.getBit(1).value).toBeFalse();
                expect(inst.getBit(2).value).toBeTrue();
            });

        });


        describe("setBit", () => {

            it("sets the correct bit value", () => {
                const inst = Int32.create(5).throwIfFailed(); // 5 is 00000000000000000000000000000101 in binary
                const res = inst.setBit(1, true).throwIfFailed(); // should set the second bit to 1, resulting in 7 (00000000000000000000000000000111)
                expect(res.value).toEqual(7);
            });

        });

    });

});


describe("UInt32", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(UInt32.dataTypeMin).toEqual(0);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(UInt32.dataTypeMax).toEqual(4294967295);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(UInt32.fromString("").failed).toBeTrue();
                expect(UInt32.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(UInt32.fromString("-1").failed).toBeTrue();
                // Over range
                expect(UInt32.fromString("4294967296").failed).toBeTrue();
            });


            it("fails when input is an in-range number that contains a fractional part", () => {
                expect(UInt32.fromString("5.2").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = UInt32.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(UInt32.create(-1).failed).toBeTrue();
                // Over range
                expect(UInt32.create(4294967296).failed).toBeTrue();
            });


            it("fails when input has a fractional part", () => {
                expect(UInt32.create(5.2).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = UInt32.create(5);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5);
            });

        });


        describe("numBits", () => {

            it("returns 32", () => {
                expect(UInt32.numBits).toEqual(32);
            });

        });


        describe("maxBitIndex", () => {

            it("returns 31", () => {
                expect(UInt32.maxBitIndex).toEqual(31);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = UInt32.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });


        describe("getBit", () => {

            it("returns the correct bit value", () => {
                const inst = UInt32.create(5).throwIfFailed(); // 5 is 00000000000000000000000000000101 in binary
                expect(inst.getBit(0).value).toBeTrue();
                expect(inst.getBit(1).value).toBeFalse();
                expect(inst.getBit(2).value).toBeTrue();
            });


            it("returns the correct bit value when the highest order bit is set", () => {
                const inst = UInt32.create(0b1000_0000_0000_0000_0000_0000_0000_0000).throwIfFailed();
                expect(inst.getBit(31).value).toBeTrue();
            });

        });


        describe("setBit", () => {

            it("sets the correct bit value", () => {
                const inst = UInt32.create(5).throwIfFailed(); // 5 is 00000000000000000000000000000101 in binary
                const res = inst.setBit(1, true).throwIfFailed(); // should set the second bit to 1, resulting in 7 (00000000000000000000000000000111)
                expect(res.value).toEqual(7);
            });

        });

    });

});


describe("Int64", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Int64.dataTypeMin).toEqual(BigInt("-9223372036854775808"));
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Int64.dataTypeMax).toEqual(BigInt("9223372036854775807"));
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Int64.fromString("").failed).toBeTrue();
                expect(Int64.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(Int64.fromString("-9223372036854775809").failed).toBeTrue();
                // Over range
                expect(Int64.fromString("9223372036854775808").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = Int64.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(BigInt(5));
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(Int64.create(BigInt("-9223372036854775809")).failed).toBeTrue();
                // Over range
                expect(Int64.create(BigInt("9223372036854775808")).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = Int64.create(BigInt(5));
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(BigInt(5));
            });

        });


        describe("numBits", () => {

            it("returns 64", () => {
                expect(Int64.numBits).toEqual(64);
            });

        });


        describe("maxBitIndex", () => {

            it("returns 63", () => {
                expect(Int64.maxBitIndex).toEqual(63);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Int64.create(BigInt(0)).throwIfFailed();
                expect(inst.value).toEqual(BigInt(0));
            });

        });


        describe("getBit", () => {

            it("returns the correct bit value", () => {
                const inst = Int64.create(BigInt(5)).throwIfFailed(); // 5 is 0000000000000000000000000000000000000000000000000000000000000101 in binary
                expect(inst.getBit(0).value).toBeTrue();
                expect(inst.getBit(1).value).toBeFalse();
                expect(inst.getBit(2).value).toBeTrue();
            });

        });


        describe("setBit", () => {

            it("sets the correct bit value", () => {
                const inst = Int64.create(BigInt(5)).throwIfFailed(); // 5 is 0000000000000000000000000000000000000000000000000000000000000101 in binary
                const res = inst.setBit(1, true).throwIfFailed(); // should set the second bit to 1, resulting in 7 (0000000000000000000000000000000000000000000000000000000000000111)
                expect(res.value).toEqual(BigInt(7));
            });

        });

    });

});


describe("UInt64", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(UInt64.dataTypeMin).toEqual(BigInt(0));
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(UInt64.dataTypeMax).toEqual(BigInt("18446744073709551615"));
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(UInt64.fromString("").failed).toBeTrue();
                expect(UInt64.fromString("a1bc").failed).toBeTrue();
            });


            it("fails when input is an integer string that is out of range", () => {
                // Under range
                expect(UInt64.fromString("-1").failed).toBeTrue();
                // Over range
                expect(UInt64.fromString("18446744073709551616").failed).toBeTrue();
            });


            it("succeeds when given an integer string", () => {
                const res = UInt64.fromString("5");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(BigInt(5));
            });

        });


        describe("create()", () => {

            it("fails when input is out of range", () => {
                // Under range
                expect(UInt64.create(BigInt(-1)).failed).toBeTrue();
                // Over range
                expect(UInt64.create(BigInt("18446744073709551616")).failed).toBeTrue();
            });


            it("succeeds when input is an integer that is in range", () => {
                const res = UInt64.create(BigInt(5));
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(BigInt(5));
            });

        });


        describe("numBits", () => {

            it("returns 64", () => {
                expect(UInt64.numBits).toEqual(64);
            });

        });


        describe("maxBitIndex", () => {

            it("returns 63", () => {
                expect(UInt64.maxBitIndex).toEqual(63);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = UInt64.create(BigInt(0)).throwIfFailed();
                expect(inst.value).toEqual(BigInt(0));
            });

        });


        describe("getBit", () => {

            it("returns the correct bit value", () => {
                const inst = UInt64.create(BigInt(5)).throwIfFailed(); // 5 is 0000000000000000000000000000000000000000000000000000000000000101 in binary
                expect(inst.getBit(0).value).toBeTrue();
                expect(inst.getBit(1).value).toBeFalse();
                expect(inst.getBit(2).value).toBeTrue();
            });


            it("returns the correct bit value when the highest order bit is set", () => {
                // eslint-disable-next-line max-len
                const inst = UInt64.create(0b1000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000n).throwIfFailed();
                expect(inst.getBit(63).value).toBeTrue();
            });

        });


        describe("setBit", () => {

            it("sets the correct bit value", () => {
                const inst = UInt64.create(BigInt(5)).throwIfFailed(); // 5 is 0000000000000000000000000000000000000000000000000000000000000101 in binary
                const res = inst.setBit(1, true).throwIfFailed(); // should set the second bit to 1, resulting in 7 (0000000000000000000000000000000000000000000000000000000000000111)
                expect(res.value).toEqual(BigInt(7));
            });

        });

    });

});


describe("Float32", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Float32.dataTypeMin).toEqual(-3.4028235e38);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Float32.dataTypeMax).toEqual(3.4028235e38);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Float32.fromString("").failed).toBeTrue();
                expect(Float32.fromString("a1bc").failed).toBeTrue();
            });


            it("succeeds when given a numeric string", () => {
                const res = Float32.fromString("5.2");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5.2);
            });

        });


        describe("create()", () => {

            it("succeeds when input is a valid float", () => {
                const res = Float32.create(5.2);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5.2);
            });

        });


        describe("numBits", () => {

            it("returns 32", () => {
                expect(Float32.numBits).toEqual(32);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Float32.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});


describe("Float64", () => {

    describe("static", () => {

        describe("dataTypeMin", () => {

            it("returns the expected minimum value", () => {
                expect(Float64.dataTypeMin).toEqual(-Number.MAX_VALUE);
            });

        });


        describe("dataTypeMax", () => {

            it("returns the expected maximum value", () => {
                expect(Float64.dataTypeMax).toEqual(Number.MAX_VALUE);
            });

        });


        describe("fromString()", () => {

            it("fails when input is a nonnumeric string", () => {
                expect(Float64.fromString("").failed).toBeTrue();
                expect(Float64.fromString("a1bc").failed).toBeTrue();
            });


            it("succeeds when given a numeric string", () => {
                const res = Float64.fromString("5.2");
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5.2);
            });

        });


        describe("create()", () => {

            it("succeeds when input is a valid float", () => {
                const res = Float64.create(5.2);
                expect(res.succeeded).toBeTrue();
                expect(res.value!.value).toEqual(5.2);
            });

        });


        describe("numBits", () => {

            it("returns 64", () => {
                expect(Float64.numBits).toEqual(64);
            });

        });

    });


    describe("instance", () => {

        describe("value", () => {

            it("returns the expected value", () => {
                const inst = Float64.create(0).throwIfFailed();
                expect(inst.value).toEqual(0);
            });

        });

    });

});
