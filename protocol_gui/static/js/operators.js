
var possibleOperations = [];
var operationResults = [];

(function(){

    function addOperations(operator, arg1, arg2, result){
        addOperation(operator, arg1, arg2, result);
        addOperation(operator, arg2, arg1, result);
    }

    function addOperation(operator, arg1, arg2, result){

        if (!possibleOperations.hasOwnProperty(arg1)) {
            possibleOperations[arg1] = [];
            operationResults[arg1] = [];
        }

        if (!possibleOperations[arg1].hasOwnProperty(arg2)){
            possibleOperations[arg1][arg2] = [];
            operationResults[arg1][arg2] = [];
        }

        possibleOperations[arg1][arg2].push(operator);
        operationResults[arg1][arg2][operator] = result;
    }


    addOperations("zip", "volume", "well", "aliquot");
    addOperations("zip", "aliquot", "aliquot", "well");


    addOperations("cross", "volume", "well", "aliquot");
    addOperations("cross", "aliquot", "aliquot", "well");

    addOperations("prod", "volume", "well", "aliquot");
    addOperations("prod", "volume", "number", "volume");
    addOperations("prod", "aliquot", "number", "aliquot");
    addOperations("prod", "well", "number", "well");
    addOperations("add", "aliquot", "aliquot", "well");

    addOperations("add", "volume", "volume", "volume");
    addOperations("add", "aliquot", "aliquot", "well");
    //addOperations("add", "aliquot", "well", "well");
    addOperations("add", "number", "number", "number");

})();

function getPossibleOperators(arg1, arg2){
     if (!possibleOperations.hasOwnProperty(arg1) || !possibleOperations[arg1].hasOwnProperty(arg2)){
         return [];
     }

    return possibleOperations[arg1][arg2];
}

function getOperationResult(operator, arg1, arg2){

    if (!operationResults.hasOwnProperty(arg1) || !operationResults[arg1].hasOwnProperty(arg2)
        || !operationResults[arg1][arg2].hasOwnProperty(operator)){
        return [];
    }

    return operationResults[arg1][arg2][operator];
}