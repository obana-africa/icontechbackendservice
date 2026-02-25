//This is the utility file
const responseError = (message, code = null) => {
  return {
    status: 'error',
    code: code,
    message: message
  }
}

const responseSuccess = (data) => {
  return {
    status: 'success',
    data: data
  }
}

const isEmail = (email) => {
  var re = /\S+@\S+\.\S+/;
  return re.test(email);
}


const setParameters = (parameters, caller) => {
  Object.entries(parameters).map(([key, value]) => {
    caller[key] = value;
  });
  // explain practically how the above works with an example
  // Objecr.entries({["a"]: "b"}) => [["a", "b"]]
  // [["a", "b"]].map(([key, value]) => { caller[key] = value })
  // caller['a'] = 'b'

  //Object.entries({a:1, b:2}) => [['a', 1], ['b', 2]]
  // [['a', 1], ['b', 2]].map(([key, value]) => { caller[key] = value })
  // caller['a'] = 1
  // caller['b'] = 2
  
  return caller;

};

const getOrderDetailTotalAmount = (order) => {
  const order_details = JSON.parse(order.order_details)
  let total = 0
  for (let item of order_details) {
    total += item.rate * item.quantity
  }
  return Number(total).toFixed(2)
}

// getVal(ref, caller, method = null){
//     if(method)
//         return caller.eval[method(ref)];

//     return caller.ref
// }


/**
* Change value of property of an object recursively
* @param target - object
* @param needle - string representing object (eg; endpoints.ssop.optional)
* @param value
* @return target
*/
const changeVal = async (target, needle, value) => {
  const parts = needle.toString().split('.');
  const newNeedle = parts;
  if (parts.length > 1) {
    const newObj = await target[parts[0]];
    newNeedle.shift();
    await changeVal(newObj, newNeedle.join('.'), value);
  } else {
    target[parts[0]] = value;
  }
  return target;
}


/**
* Get value of a property of an object recursively
* @param data - object
* @param needle - string representing object 
* eg:
*   1. endpoints.ssop.optional
*   2. custom_attributes.['attribute_code','image','value'] 
*    - First item in the array is the search criteria,
*    - Second is the match value
*    - Third is the key to be return. Where not available, returns the entire object
* @return val string
*/
const getVal = async (data, needle) => {
  const parts = needle.toString().split('.');
  let temp_data = JSON.parse(JSON.stringify(data));
  await parts.forEach(async (e) => {
    const pattern = /\[[',"{}:a-zA-Z_-]*\]/g;
    if (e.match(pattern)) {
      temp_data = await getArrayVal(temp_data, e);
    } else {
      temp_data = temp_data[e];
    }
  });
  return temp_data;
}

/**
* Get value from array of objects 
* @param {*} arr - Array
* @param {*} target - Array
*  Eg: ['attribute_code','image','value']
*    - First item in the array is the search criteria,
*    - Second is the match value
*    - Third is the key to be return. Where not available, returns the entire object
* @returns val
*/
const getArrayVal = async (arr, target) => {
  target = target.match(/(\{.*\})|([a-zA-Z_-]+)/g)
  let data = arr.filter((item) => {
    return item[target[0]] == target[1];
  })
  if (target[2]) {
    if (data.length === 1) {
      data = data[0][target[2]];
    } else {
      const temp = [];
      await data.forEach((item) => {
        temp.push(item[[2]]);
      })
      data = temp;
    }
  }
  return data;
}

const generateRandomString = (length) => {
  return Math.random().toString(36).substr(2, length);
}

const genCuponCode = () => {
  return `${temPassword()}${Date.now()}`
}

function temPassword() {
  const arr = "ABCDEFGHIJK$£$*&@LMNOPQRSTUVWXYZabcdefgh12345678ijklmnopqrstuvwxyz1234567890!$£$*&@"
  let ans = '';
  for (let i = 10; i > 0; i--) {
    ans +=
      arr[(Math.floor(Math.random() * arr.length))];
  }
  return ans;
}

const scopeMiddleware = (allowScope) => {
  return (req, res, next) => {
    if (!req?.user?.permission?.scope.includes(allowScope)) {
      return res.status(403).json({ "message": `Access denied. Youd need ${allowScope} scope to access this resources` })
    }
    next()
  }
}


const zohoHerders = (token, form = null) => {
  return {
    'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
    'Authorization': token
  }
}

const validateAndCleanObject = (obj, allowedKeys) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => allowedKeys.includes(key))
  );
}
const default7DaysInterval = () => {
  let endDate = (new Date().toISOString()).split("T")[0];
  let startDate = (new Date(new Date().setDate(new Date().getDate() - 6))).toISOString().split("T")[0];
  return { startDate, endDate }
}

const flattenObj = (ob) => {
  let result = {};
  for (const i in ob) {
    if ((typeof ob[i]) === 'object' && !Array.isArray(ob[i])) {
      const temp = flattenObj(ob[i]);
      for (const j in temp) {
        result[j] = temp[j];
      }
    }
    else {
      result[i] = ob[i];
    }
  }
  return result;
};

const formartShipment = (cartDetails) => {
  const shipmentDetail = cartDetails.map(item => {
    return {
      "description": item.name,
      "name": item.name,
      "currency": "NGN",
      "value": item.total_price,
      "quantity": item.quantity,
      "weight": item.weight
    }
  })
  return shipmentDetail
}


  const formartShipmentIDAddr = (cartDetails) => {
  const shipmentDetail = cartDetails.map(item => {
    return {
      "description": item.name,
      "name": item.name,
      "currency": "NGN",
      "value": item.total_price,
      "quantity": item.quantity,
      "weight": item.weight,
      "pickup_address": item.pickup_address,
      "rate_id": item.rate_id //should be rate_id per group instead, fix
    }
  })
  return shipmentDetail
}

const isStaging = () => {
  return process.env.NODE_ENV !== 'production' ? true : false
}

module.exports = {
  responseError,
  responseSuccess,
  isEmail,
  changeVal,
  getVal,
  setParameters,
  generateRandomString,
  zohoHerders,
  scopeMiddleware,
  validateAndCleanObject,
  default7DaysInterval,
  temPassword,
  flattenObj,
  genCuponCode,
  formartShipment,
  isStaging,
  getOrderDetailTotalAmount,
  formartShipmentIDAddr
}
