// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library Math {
    enum Rounding {
        Floor, // Toward negative infinity / toward zero for unsigned
        Ceil, // Toward positive infinity / away from zero for unsigned
        Trunc // Toward zero
    }

    function mulDiv(uint256 x, uint256 y, uint256 denominator, Rounding rounding)
        internal
        pure
        returns (uint256 result)
    {
        require(denominator > 0, "Math: division by zero");
        uint256 prod0;
        uint256 prod1;
        assembly {
            let mm := mulmod(x, y, not(0))
            prod0 := mul(x, y)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }

        if (prod1 == 0) {
            result = prod0 / denominator;
            if (rounding == Rounding.Ceil && mulmod(x, y, denominator) > 0) {
                result += 1;
            }
            return result;
        }

        require(denominator > prod1, "Math: mulDiv overflow");

        uint256 remainder;
        assembly {
            remainder := mulmod(x, y, denominator)
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)
        }

        uint256 twos = (0 - denominator) & denominator;
        assembly {
            denominator := div(denominator, twos)
            prod0 := div(prod0, twos)
            twos := add(div(sub(0, twos), twos), 1)
        }

        prod0 |= prod1 * twos;

        uint256 inverse = (3 * denominator) ^ 2;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;

        result = prod0 * inverse;

        if (rounding == Rounding.Ceil && remainder > 0) {
            result += 1;
        }
    }

    function mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        return mulDiv(x, y, denominator, Rounding.Floor);
    }
}
